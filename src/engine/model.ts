import type { RootContent } from 'mdast'
import type { StrategyName } from './strategies'

/**
 * The document model. Nothing in here belongs to a renderer: a segment carries
 * mdast nodes, never markup, and the only structure it knows about is "a
 * document is a list of sections, a section is one or more segments". A
 * presentation maps that onto slides, a book onto a continuous scroll, and
 * neither shape is baked into the model.
 */
export interface DocumentModel {
  title: string
  /** How the document was divided; see `strategies/`. */
  strategy: StrategyName
  /** Every segment in reading order. Index into this is *the* position. */
  segments: Segment[]
  /** Sections in reading order, each pointing at the segments it owns. */
  sections: Section[]
  toc: TocEntry[]
}

/**
 * One readable unit of the document: a whole section, or one part of a section
 * that was too long to hold together.
 */
export interface Segment {
  /** Index in `DocumentModel.segments`, i.e. reading order. */
  index: number
  /** Title shown above the segment and in the table of contents. */
  title: string
  /** Title of the enclosing `#` group, for breadcrumb context. */
  group: string
  /** 1 for `# `, 2 for `## `, 0 for content that has no heading of its own. */
  level: number
  /** 1-based part number when a long section is divided across segments. */
  part: number
  partCount: number
  /** Index of the enclosing section in `DocumentModel.sections`. */
  section: number
  /** Body of the segment (the section heading itself is rendered separately). */
  nodes: RootContent[]
  /** Flattened text, used by search. */
  text: string
}

/** A section of the document and the segments it was divided into. */
export interface Section {
  index: number
  title: string
  group: string
  level: number
  /** Indices into `DocumentModel.segments`, in reading order. */
  segments: number[]
}

export interface TocEntry {
  title: string
  level: number
  /** First segment of the section; its other parts follow in reading order. */
  segmentIndex: number
  sectionIndex: number
}
