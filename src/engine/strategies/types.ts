import type { Root, RootContent } from 'mdast'

/** Every strategy the engine knows how to divide a document with. */
export type StrategyName = 'headings' | 'h1' | 'fixed-length'

/**
 * A section as a strategy produced it, already divided into parts. Titles,
 * groups and indices are finished by `compile()`; a strategy only has to say
 * where the document breaks.
 */
export interface StrategySection {
  title: string
  /** 1 for `# `, 2 for `## `, 0 for a section with no heading of its own. */
  level: number
  /**
   * Enclosing `#` group, when the strategy tracks one. Left undefined, the
   * compiler fills it from the most recent level-1 section.
   */
  group?: string
  /** One entry per part; a section that holds together has exactly one. */
  parts: RootContent[][]
}

export interface StrategyContext {
  /** Approximate number of rendered lines a segment may hold before it divides. */
  maxWeight: number
}

/**
 * How a document is divided. The interface is deliberately this small: the
 * shared thing between strategies is the *model*, not a pipeline of hooks —
 * `weightOf` and `splitByWeight` are helpers a strategy may use, not steps it
 * must implement.
 */
export interface SegmentationStrategy {
  name: StrategyName
  /** Shown in the toolbar. */
  label: string
  /** One line, shown as the control's tooltip. */
  description: string
  divide(root: Root, context: StrategyContext): StrategySection[]
}
