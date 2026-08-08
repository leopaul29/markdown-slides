import type { Heading, Root, RootContent } from 'mdast'
import { nodeText, parseMarkdown, searchableText } from './markdown'

export interface Slide {
  /** Index in `deck.slides`, i.e. reading order. */
  index: number
  /** Title shown in the slide header and the table of contents. */
  title: string
  /** Title of the enclosing `#` group, for breadcrumb context on `##` slides. */
  group: string
  /** 1 for `# `, 2 for `## `, 0 for content that precedes any heading. */
  level: number
  /** 1-based part number when a long section is split across several slides. */
  part: number
  partCount: number
  /** Body of the slide (the section heading itself is rendered separately). */
  nodes: RootContent[]
  /** Flattened text, used by search. */
  text: string
}

export interface TocEntry {
  title: string
  level: number
  /** First slide of the section; its parts follow it in reading order. */
  slideIndex: number
}

export interface Deck {
  title: string
  slides: Slide[]
  /** Slides grouped by section: one column per `h`, parts stacked vertically. */
  columns: Slide[][]
  toc: TocEntry[]
}

export interface BuildOptions {
  /** Approximate number of rendered lines a slide may hold before it splits. */
  maxWeight?: number
}

const DEFAULT_MAX_WEIGHT = 26
/** Characters of prose that roughly fill one rendered line. */
const CHARS_PER_LINE = 90

/** A section as produced by the heading rules, before any auto-splitting. */
interface Section {
  title: string
  level: number
  nodes: RootContent[]
}

export function buildDeck(markdown: string, options: BuildOptions = {}): Deck {
  const maxWeight = options.maxWeight ?? DEFAULT_MAX_WEIGHT
  const sections = splitIntoSections(parseMarkdown(markdown))
  const slides: Slide[] = []
  const columns: Slide[][] = []
  let group = ''

  for (const section of sections) {
    if (section.level === 1) group = section.title
    const parts = splitSection(section.nodes, maxWeight)
    const column: Slide[] = []
    for (const [partIndex, nodes] of parts.entries()) {
      const slide: Slide = {
        index: slides.length,
        title: section.title,
        group: section.level === 1 ? '' : group,
        level: section.level,
        part: partIndex + 1,
        partCount: parts.length,
        nodes,
        text: nodes.map((node) => searchableText(node)).join('\n'),
      }
      slides.push(slide)
      column.push(slide)
    }
    columns.push(column)
  }

  return {
    title: sections.find((section) => section.level === 1)?.title ?? sections[0]?.title ?? 'Untitled',
    slides,
    columns,
    toc: buildToc(columns),
  }
}

/**
 * Heading rules from the PRD:
 * every `#` starts a new slide group, every `##` starts a new slide, and
 * `###`+ stay inside the current slide.
 */
function splitIntoSections(root: Root): Section[] {
  const sections: Section[] = []
  let current: Section | null = null

  for (const node of root.children) {
    if (node.type === 'heading' && (node.depth === 1 || node.depth === 2)) {
      current = { title: headingText(node), level: node.depth, nodes: [] }
      sections.push(current)
      continue
    }
    if (!current) {
      // Content before the first heading becomes an opening slide.
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

/**
 * Splits one section into slide-sized chunks. Individual blocks are never
 * broken up, so a code block or a table always stays intact — it simply gets a
 * slide of its own when it is too tall to share one.
 */
function splitSection(nodes: RootContent[], maxWeight: number): RootContent[][] {
  if (nodes.length === 0) return [[]]

  const parts: RootContent[][] = []
  let current: RootContent[] = []
  let weight = 0

  const flush = () => {
    if (current.length > 0) {
      parts.push(current)
      current = []
      weight = 0
    }
  }

  for (const node of nodes) {
    const nodeWeight = weightOf(node)
    const isSubheading = node.type === 'heading'
    // A subheading is a natural break: use it once the slide is over half full
    // rather than pushing content past the fold.
    const breakAtHeading = isSubheading && weight > maxWeight * 0.55
    if (current.length > 0 && (breakAtHeading || weight + nodeWeight > maxWeight)) {
      flush()
    }
    current.push(node)
    weight += nodeWeight
  }
  flush()

  return rebalanceOrphanHeadings(parts)
}

/** Never let a slide end on a heading whose content lives on the next slide. */
function rebalanceOrphanHeadings(parts: RootContent[][]): RootContent[][] {
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i]
    while (part.length > 1 && part[part.length - 1].type === 'heading') {
      parts[i + 1].unshift(part.pop() as RootContent)
    }
  }
  return parts.filter((part) => part.length > 0)
}

/** Rough height of a block in rendered lines. Deterministic, no measurement. */
function weightOf(node: RootContent): number {
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

function isVisible(node: RootContent): boolean {
  if (node.type === 'definition' || node.type === 'footnoteDefinition') return false
  return nodeText(node).trim().length > 0 || node.type === 'thematicBreak' || hasImage(node)
}

function hasImage(node: RootContent): boolean {
  if (node.type === 'image' || node.type === 'imageReference') return true
  const children = 'children' in node ? node.children : []
  return children.some((child) => hasImage(child as RootContent))
}

function headingText(node: Heading): string {
  return nodeText(node).trim() || 'Untitled'
}

/** One entry per section, in reading order. Depth is carried by `level`. */
function buildToc(columns: Slide[][]): TocEntry[] {
  return columns
    .map((column) => column[0])
    .filter((slide): slide is Slide => slide !== undefined)
    .map((slide) => ({
      title: slide.title || 'Overview',
      level: slide.level,
      slideIndex: slide.index,
    }))
}
