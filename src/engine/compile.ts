import { parseMarkdown, searchableText } from './markdown'
import type { DocumentModel, Section, Segment, TocEntry } from './model'
import { DEFAULT_STRATEGY, strategyByName, type StrategyName } from './strategies'

export interface CompileOptions {
  /** How the document is divided. Defaults to `headings` (the v1 rules). */
  strategy?: StrategyName
  /** Approximate number of rendered lines a segment may hold before it divides. */
  maxWeight?: number
}

const DEFAULT_MAX_WEIGHT = 26

/**
 * Markdown in, document model out. This is the engine's single entry point:
 * every view consumes what it returns and nothing else, and it knows nothing
 * about how any of them render.
 *
 * Pure and deterministic — the same text and options always produce the same
 * model. The one transformation applied to the input is `normalize()`, which
 * repairs exporter-escaped punctuation in memory (see `ROADMAP.md`).
 *
 * *Experimental*: this shape is settling as the second view is built against
 * it. It becomes the frozen public API once Book View has proven it.
 */
export function compile(markdown: string, options: CompileOptions = {}): DocumentModel {
  const maxWeight = options.maxWeight ?? DEFAULT_MAX_WEIGHT
  const strategy = strategyByName(options.strategy ?? DEFAULT_STRATEGY)
  const divided = strategy.divide(parseMarkdown(markdown), { maxWeight })

  const segments: Segment[] = []
  const sections: Section[] = []
  let group = ''

  for (const raw of divided) {
    if (raw.level === 1) group = raw.title
    const sectionIndex = sections.length
    const sectionGroup = raw.group ?? (raw.level === 1 ? '' : group)
    const section: Section = {
      index: sectionIndex,
      title: raw.title,
      group: sectionGroup,
      level: raw.level,
      segments: [],
    }

    for (const [partIndex, nodes] of raw.parts.entries()) {
      const segment: Segment = {
        index: segments.length,
        title: raw.title,
        group: sectionGroup,
        level: raw.level,
        part: partIndex + 1,
        partCount: raw.parts.length,
        section: sectionIndex,
        nodes,
        text: nodes.map((node) => searchableText(node)).join('\n'),
      }
      section.segments.push(segment.index)
      segments.push(segment)
    }

    sections.push(section)
  }

  return {
    title: titleOf(sections),
    strategy: strategy.name,
    segments,
    sections,
    toc: buildToc(sections),
  }
}

function titleOf(sections: Section[]): string {
  return (
    sections.find((section) => section.level === 1)?.title || sections[0]?.title || 'Untitled'
  )
}

/** One entry per section, in reading order. Depth is carried by `level`. */
function buildToc(sections: Section[]): TocEntry[] {
  return sections
    .filter((section) => section.segments.length > 0)
    .map((section) => ({
      title: section.title || 'Overview',
      level: section.level,
      segmentIndex: section.segments[0],
      sectionIndex: section.index,
    }))
}
