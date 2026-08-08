import type { Heading, Root, RootContent } from 'mdast'
import { headingText, isVisible } from '../nodes'
import { chunkByWeight, rebalanceOrphanHeadings } from './split'
import type { SegmentationStrategy, StrategySection } from './types'

/**
 * Even pages, whatever the document's shape. Blocks are packed until the page
 * is full and then a new one starts — headings do not open a page, they only
 * name it. A document with one enormous `##` section and a document with fifty
 * tiny ones therefore read the same way.
 *
 * Pages that fall under the same heading are kept together as one section, so
 * the table of contents still lists headings rather than page numbers and the
 * pages of a section are numbered 1/3, 2/3, 3/3.
 */
function divide(root: Root, { maxWeight }: { maxWeight: number }): StrategySection[] {
  const chunks = rebalanceOrphanHeadings(chunkByWeight(root.children, maxWeight)).filter((chunk) =>
    chunk.some(isVisible),
  )
  if (chunks.length === 0) return [{ title: 'Empty document', level: 0, parts: [[]] }]

  const sections: StrategySection[] = []
  let title = ''
  let level = 0
  let group = ''

  for (const chunk of chunks) {
    const opener = firstHeading(chunk)
    if (opener) {
      title = headingText(opener)
      level = Math.min(opener.depth, 2)
    }
    const lastTopLevel = lastHeadingAtDepth(chunk, 1)
    if (lastTopLevel) group = headingText(lastTopLevel)

    const previous = sections[sections.length - 1]
    if (previous && previous.title === title && previous.level === level) {
      previous.parts.push(chunk)
      continue
    }
    sections.push({ title, level, group: level === 1 ? '' : group, parts: [chunk] })
  }

  return sections
}

/** The heading that names a page: the first one shallow enough to be a title. */
function firstHeading(chunk: RootContent[]): Heading | null {
  for (const node of chunk) {
    if (node.type === 'heading' && node.depth <= 3) return node
  }
  return null
}

function lastHeadingAtDepth(chunk: RootContent[], depth: number): Heading | null {
  let found: Heading | null = null
  for (const node of chunk) {
    if (node.type === 'heading' && node.depth === depth) found = node
  }
  return found
}

export const fixedLengthStrategy: SegmentationStrategy = {
  name: 'fixed-length',
  label: 'Fixed length',
  description: 'Even pages packed to the same height, ignoring where headings fall',
  divide,
}
