import { fixedLengthStrategy } from './fixed-length'
import { h1Strategy, headingsStrategy } from './headings'
import type { SegmentationStrategy, StrategyName } from './types'

export type {
  SegmentationStrategy,
  StrategyContext,
  StrategyName,
  StrategySection,
} from './types'
export { chunkByWeight, splitByWeight } from './split'

/**
 * The named strategies, in the order they are offered. `headings` is the
 * default and reproduces the v1 rules exactly.
 */
export const STRATEGIES: readonly SegmentationStrategy[] = [
  headingsStrategy,
  h1Strategy,
  fixedLengthStrategy,
]

export const DEFAULT_STRATEGY: StrategyName = 'headings'

/**
 * Unknown names fall back to the default rather than throwing: a stale
 * persisted setting must never stop a document from opening.
 */
export function strategyByName(name: string | undefined): SegmentationStrategy {
  return STRATEGIES.find((strategy) => strategy.name === name) ?? STRATEGIES[0]
}
