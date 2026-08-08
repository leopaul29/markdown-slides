import type { RootContent } from 'mdast'
import { nodeText } from './markdown'

/** Characters of prose that roughly fill one rendered line. */
const CHARS_PER_LINE = 90

/**
 * Rough height of a block in rendered lines. Deterministic and cheap: nothing
 * here measures anything, so the same document always divides the same way
 * whatever the window, the font or the view.
 */
export function weightOf(node: RootContent): number {
  switch (node.type) {
    case 'code':
      return countLines(node.value) + 2
    case 'table':
      return node.children.length + 2
    case 'list':
      return node.children.reduce((total, item) => total + Math.max(1, textLines(item)), 0) + 1
    case 'blockquote':
      return node.children.reduce((total, child) => total + weightOf(child as RootContent), 0) + 1
    case 'heading':
      return node.depth <= 3 ? 3 : 2
    case 'thematicBreak':
      return 1
    case 'paragraph':
      return isImageOnly(node) ? 12 : textLines(node)
    case 'html':
      return 1
    default:
      return textLines(node as RootContent)
  }
}

function textLines(node: RootContent): number {
  const text = nodeText(node)
  return Math.max(1, Math.ceil(text.length / CHARS_PER_LINE))
}

function countLines(value: string): number {
  return value.split('\n').length
}

function isImageOnly(node: RootContent): boolean {
  return (
    node.type === 'paragraph' &&
    node.children.length > 0 &&
    node.children.every((child) => child.type === 'image' || child.type === 'imageReference')
  )
}
