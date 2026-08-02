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
 * mdast → hast. Raw HTML in the source is intentionally dropped (no
 * `allowDangerousHtml`) so that opening an untrusted document cannot execute
 * script in the reader.
 */
const toHast = unified()
  .use(remarkRehype)
  .use(rehypeSlug)
  .use(rehypeHighlight, { detect: false, ignoreMissing: true })

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
