import type { Root, RootContent } from 'mdast'
import { headingText, isVisible } from '../nodes'
import { splitByWeight } from './split'
import type { SegmentationStrategy } from './types'

/**
 * Sections opened by headings. `openAt` is the deepest heading level that opens
 * one: everything below it stays inside the section it falls in, and content
 * before the first heading becomes an opening section.
 *
 * Two strategies come out of this: `headings` (the v1 rules — `#` opens a
 * group, `##` opens a section) and `h1` (only `#` opens one, which suits a
 * document whose `##` headings are short subsections).
 */
function byHeadings(openAt: 1 | 2): SegmentationStrategy['divide'] {
  return (root: Root, { maxWeight }) =>
    rawSections(root, openAt).map((section) => ({
      title: section.title,
      level: section.level,
      parts: splitByWeight(section.nodes, maxWeight),
    }))
}

interface RawSection {
  title: string
  level: number
  nodes: RootContent[]
}

function rawSections(root: Root, openAt: 1 | 2): RawSection[] {
  const sections: RawSection[] = []
  let current: RawSection | null = null

  for (const node of root.children) {
    if (node.type === 'heading' && node.depth <= openAt) {
      current = { title: headingText(node), level: node.depth, nodes: [] }
      sections.push(current)
      continue
    }
    if (!current) {
      // Content before the first heading becomes an opening section.
      current = { title: '', level: 0, nodes: [] }
      sections.push(current)
    }
    current.nodes.push(node)
  }

  const meaningful = sections.filter(
    (section) => section.title !== '' || section.nodes.some(isVisible),
  )
  return meaningful.length > 0 ? meaningful : [{ title: 'Empty document', level: 0, nodes: [] }]
}

export const headingsStrategy: SegmentationStrategy = {
  name: 'headings',
  label: 'Headings',
  description: '# opens a group, ## opens a section, deeper headings stay inside',
  divide: byHeadings(2),
}

export const h1Strategy: SegmentationStrategy = {
  name: 'h1',
  label: 'Top level only',
  description: 'Only # opens a section; ## and deeper stay inside it',
  divide: byHeadings(1),
}
