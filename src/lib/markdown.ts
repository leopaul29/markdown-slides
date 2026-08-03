import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeSlug from 'rehype-slug'
import rehypeHighlight from 'rehype-highlight'
import { toHtml } from 'hast-util-to-html'
import { toString as mdastToString } from 'mdast-util-to-string'
import type { Root, RootContent } from 'mdast'

/** Markdown → mdast. GFM gives us tables, strikethrough, task lists and autolinks. */
const parser = unified().use(remarkParse).use(remarkGfm)

/**
 * mdast → hast. Two things keep an untrusted document from executing script in
 * the reader: raw HTML in the source is dropped (no `allowDangerousHtml`), and
 * link and image URLs are restricted to safe schemes.
 */
const toHast = unified()
  .use(remarkRehype)
  .use(rehypeSlug)
  .use(rehypeHighlight, { detect: false, ignoreMissing: true })
  .use(rehypeSafeUrls)

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

/** Plain text of a node, used for search and slide titles. */
export function nodeText(node: RootContent | Root): string {
  return mdastToString(node)
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
        const value = properties[key]
        if (typeof value !== 'string') continue
        if (!isSafeUrl(value, node.tagName === 'a' || node.tagName === 'area')) {
          delete properties[key]
        }
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
