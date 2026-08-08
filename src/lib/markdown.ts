import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import { createLowlight } from 'lowlight'
import { toHtml } from 'hast-util-to-html'
import { toString as mdastToString } from 'mdast-util-to-string'
import type { Root, RootContent, Table } from 'mdast'
import bash from 'highlight.js/lib/languages/bash'
import c from 'highlight.js/lib/languages/c'
import cpp from 'highlight.js/lib/languages/cpp'
import csharp from 'highlight.js/lib/languages/csharp'
import css from 'highlight.js/lib/languages/css'
import diff from 'highlight.js/lib/languages/diff'
import dockerfile from 'highlight.js/lib/languages/dockerfile'
import go from 'highlight.js/lib/languages/go'
import ini from 'highlight.js/lib/languages/ini'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import kotlin from 'highlight.js/lib/languages/kotlin'
import markdown from 'highlight.js/lib/languages/markdown'
import php from 'highlight.js/lib/languages/php'
import python from 'highlight.js/lib/languages/python'
import ruby from 'highlight.js/lib/languages/ruby'
import rust from 'highlight.js/lib/languages/rust'
import sql from 'highlight.js/lib/languages/sql'
import swift from 'highlight.js/lib/languages/swift'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'

/*
 * Highlighting grammars are the largest thing in the bundle. `rehype-highlight`
 * statically imports highlight.js' full "common" set, so its `languages` option
 * cannot shrink it — driving lowlight directly is what actually trims the
 * bundle. These are the languages that turn up in the documents this reader
 * targets; anything else still renders, just without colour.
 */
const lowlight = createLowlight({
  bash, c, cpp, csharp, css, diff, dockerfile, go, ini, java, javascript, json, kotlin,
  markdown, php, python, ruby, rust, sql, swift, typescript, xml, yaml,
})

/** Aliases people actually write in fences, mapped to a registered grammar. */
const LANGUAGE_ALIASES: Record<string, string> = {
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  sh: 'bash', shell: 'bash', zsh: 'bash', console: 'bash',
  yml: 'yaml', html: 'xml', svg: 'xml', vue: 'xml',
  py: 'python', rb: 'ruby', rs: 'rust', kt: 'kotlin', 'c++': 'cpp', cs: 'csharp',
  md: 'markdown', toml: 'ini', patch: 'diff', golang: 'go', postgres: 'sql', psql: 'sql',
}

/** Markdown → mdast. GFM gives us tables, strikethrough, task lists and autolinks. */
const parser = unified().use(remarkParse).use(remarkGfm)

/**
 * mdast → hast. Two things keep an untrusted document from executing script in
 * the reader: raw HTML in the source is dropped (no `allowDangerousHtml`), and
 * link and image URLs are restricted to safe schemes.
 */
const toHast = unified().use(remarkRehype).use(rehypeSyntaxHighlight).use(rehypeSafeUrls)

export function parseMarkdown(markdown: string): Root {
  return parser.parse(normalize(markdown)) as Root
}

/** Renders a slice of an mdast tree to an HTML string. */
export function nodesToHtml(nodes: RootContent[]): string {
  if (nodes.length === 0) return ''
  const root: Root = { type: 'root', children: nodes }
  const hast = toHast.runSync(root as never)
  return toHtml(hast as never)
}

/** Plain text of a node, used for slide titles. */
export function nodeText(node: RootContent | Root): string {
  return mdastToString(node)
}

/**
 * Text for the search index. `mdast-util-to-string` concatenates without
 * separators, which welds table cells and list items into one unreadable run
 * ("KeyActionPrevious"). Blocks are joined with newlines and cells with " | "
 * so that snippets stay legible.
 */
export function searchableText(node: RootContent | Root): string {
  if (node.type === 'table') return tableText(node as Table)
  if (node.type === 'code') return (node as { value: string }).value
  const children = 'children' in node ? (node.children as RootContent[]) : []
  if (children.length === 0) return mdastToString(node)

  const isBlock = node.type === 'root' || node.type === 'list' || node.type === 'blockquote'
  if (!isBlock && !children.some((child) => BLOCK_TYPES.has(child.type))) {
    return mdastToString(node)
  }
  return children.map((child) => searchableText(child)).join('\n')
}

const BLOCK_TYPES = new Set([
  'paragraph', 'heading', 'list', 'listItem', 'table', 'code', 'blockquote', 'thematicBreak',
])

function tableText(table: Table): string {
  return table.children
    .map((row) => row.children.map((cell) => mdastToString(cell).trim()).join(' | '))
    .join('\n')
}

/**
 * Some editors (and Windows exports) escape Markdown punctuation, which turns
 * `# Title` into `\# Title` and silently destroys the document structure.
 * A document is only unescaped when the pattern is dominant, so ordinary
 * escapes inside a normal document are left untouched.
 */
export function normalize(markdown: string): string {
  const text = markdown.replace(/\r\n?/g, '\n')
  const escapedHeadings = text.match(/^\\#{1,6} /gm)?.length ?? 0
  const realHeadings = text.match(/^#{1,6} /gm)?.length ?? 0
  if (escapedHeadings > 2 && escapedHeadings > realHeadings) {
    return text.replace(/\\([#*_`>\-+.[\]()!&\\])/g, '$1')
  }
  return text
}

/*
 * Markdown links are not raw HTML, so dropping raw HTML is not enough on its
 * own: `[click](javascript:…)` survives the mdast → hast conversion and would
 * execute when the reader clicks it. Every URL-bearing attribute is therefore
 * checked before the tree is serialized.
 */

const LINK_SCHEMES = new Set(['http', 'https', 'mailto', 'tel'])
/** Images may also come from `data:image/…`; SVG loaded as an image cannot script. */
const IMAGE_SCHEMES = new Set(['http', 'https'])
const URL_ATTRIBUTES: Record<string, string[]> = {
  a: ['href'],
  area: ['href'],
  img: ['src', 'srcset'],
  video: ['src', 'poster'],
  audio: ['src'],
  source: ['src', 'srcset'],
}

interface HastElement {
  type: string
  tagName?: string
  properties?: Record<string, unknown>
  children?: HastElement[]
}

/** Highlighting runs before the URL guard, so both see the final tree. */

/**
 * Highlights fenced code blocks whose language is registered above. Unknown
 * languages are left alone rather than guessed at, so highlighting stays
 * deterministic.
 */
function rehypeSyntaxHighlight() {
  return (tree: HastElement) => highlightCode(tree)
}

function highlightCode(node: HastElement): void {
  if (node.type === 'element' && node.tagName === 'pre') {
    const code = node.children?.find((child) => child.tagName === 'code')
    if (code) {
      const language = registeredLanguage(code)
      if (language) {
        const result = lowlight.highlight(language, textOf(code)) as unknown as HastElement
        code.children = result.children ?? []
        const className = (code.properties?.className as string[] | undefined) ?? []
        code.properties = { ...code.properties, className: ['hljs', ...className] }
      }
    }
    return
  }
  for (const child of node.children ?? []) highlightCode(child)
}

function registeredLanguage(code: HastElement): string | null {
  const classes = (code.properties?.className as string[] | undefined) ?? []
  const name = languageFromClasses(classes)
  if (!name) return null
  const resolved = LANGUAGE_ALIASES[name] ?? name
  return lowlight.registered(resolved) ? resolved : null
}

/** The `language-…` class remark writes for a fenced block, if any. */
export function languageFromClasses(classes: Iterable<string>): string | null {
  for (const className of classes) {
    if (className.startsWith('language-')) return className.slice('language-'.length).toLowerCase()
  }
  return null
}

function textOf(node: HastElement): string {
  if (node.type === 'text') return (node as unknown as { value: string }).value
  return (node.children ?? []).map((child) => textOf(child)).join('')
}

function rehypeSafeUrls() {
  return (tree: HastElement) => walk(tree)
}

function walk(node: HastElement): void {
  if (node.type === 'element' && node.tagName) {
    const attributes = URL_ATTRIBUTES[node.tagName]
    const properties = node.properties
    if (attributes && properties) {
      for (const attribute of attributes) {
        const key = attribute === 'srcset' ? 'srcSet' : attribute
        const isLink = node.tagName === 'a' || node.tagName === 'area'
        const value = properties[key]

        // hast keeps `srcset` as a list of "url descriptor" candidates.
        if (Array.isArray(value)) {
          const safe = value.filter(
            (candidate) =>
              typeof candidate === 'string' && isSafeUrl(String(candidate).split(/\s+/)[0], isLink),
          )
          if (safe.length === 0) delete properties[key]
          else properties[key] = safe
          continue
        }

        if (typeof value !== 'string') continue
        if (!isSafeUrl(value, isLink)) delete properties[key]
      }
    }
  }
  for (const child of node.children ?? []) walk(child)
}

/**
 * Relative URLs and fragments are always allowed; an absolute URL must use a
 * scheme from the allow-list. Control characters and whitespace are stripped
 * first, because browsers ignore them when resolving `java\tscript:`.
 */
export function isSafeUrl(url: string, isLink: boolean): boolean {
  const cleaned = url.replace(/[\u0000-\u0020\u007f-\u009f]/g, '')
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(cleaned)
  if (!scheme) return true // relative path, fragment or query
  const name = scheme[1].toLowerCase()
  if (isLink) return LINK_SCHEMES.has(name)
  if (IMAGE_SCHEMES.has(name)) return true
  return /^data:image\/(png|jpe?g|gif|webp|avif|svg\+xml)[;,]/i.test(cleaned)
}
