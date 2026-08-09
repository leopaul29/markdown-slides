import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import { toString as mdastToString } from 'mdast-util-to-string'
import type { Root, RootContent, Table } from 'mdast'

/** Markdown → mdast. GFM gives us tables, strikethrough, task lists and autolinks. */
const parser = unified().use(remarkParse).use(remarkGfm)

export function parseMarkdown(markdown: string): Root {
  return parser.parse(normalize(markdown)) as Root
}

/** Plain text of a node, used for section titles. */
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
