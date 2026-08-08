import type { Heading, RootContent } from 'mdast'
import { nodeText } from './markdown'

/** Text of a heading, as used for section titles. */
export function headingText(node: Heading): string {
  return nodeText(node).trim() || 'Untitled'
}

/**
 * Would this block put anything on the page? Link and footnote definitions are
 * carried by the model but render to nothing, so a section made only of them is
 * not worth a segment of its own.
 */
export function isVisible(node: RootContent): boolean {
  if (node.type === 'definition' || node.type === 'footnoteDefinition') return false
  return nodeText(node).trim().length > 0 || node.type === 'thematicBreak' || hasImage(node)
}

function hasImage(node: RootContent): boolean {
  if (node.type === 'image' || node.type === 'imageReference') return true
  const children = 'children' in node ? node.children : []
  return children.some((child) => hasImage(child as RootContent))
}
