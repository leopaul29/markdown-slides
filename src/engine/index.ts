/**
 * The engine: Markdown text in, document model out.
 *
 * Nothing under `src/engine/` may import the render layer or know about HTML —
 * that is what lets a non-HTML view consume the same model, and it is enforced
 * by `boundary.test.ts` rather than left to good intentions.
 */
export { compile, type CompileOptions } from './compile'
export type { DocumentModel, Section, Segment, TocEntry } from './model'
export {
  DEFAULT_STRATEGY,
  STRATEGIES,
  strategyByName,
  type SegmentationStrategy,
  type StrategyName,
} from './strategies'
export { normalize, parseMarkdown } from './markdown'
