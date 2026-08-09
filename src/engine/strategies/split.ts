import type { RootContent } from 'mdast'
import { weightOf } from '../weight'

/**
 * Divides one section into parts no heavier than `maxWeight`. Individual blocks
 * are never broken up, so a code block or a table always stays intact — it
 * simply gets a part of its own when it is too tall to share one.
 *
 * Shared by every strategy that respects headings; `fixed-length` uses
 * `chunkByWeight` below instead, because for it the division *is* the strategy.
 */
export function splitByWeight(nodes: RootContent[], maxWeight: number): RootContent[][] {
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
    // A subheading is a natural break: use it once the part is over half full
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

/**
 * Divides a run of blocks into chunks of at most `maxWeight`, with no regard
 * for headings. Blocks stay intact, exactly as above.
 */
export function chunkByWeight(nodes: RootContent[], maxWeight: number): RootContent[][] {
  const chunks: RootContent[][] = []
  let current: RootContent[] = []
  let weight = 0

  for (const node of nodes) {
    const nodeWeight = weightOf(node)
    if (current.length > 0 && weight + nodeWeight > maxWeight) {
      chunks.push(current)
      current = []
      weight = 0
    }
    current.push(node)
    weight += nodeWeight
  }
  if (current.length > 0) chunks.push(current)

  return chunks
}

/**
 * Never let a part end on a heading whose content lives in the next one — not
 * even when the heading is the only thing in the part. That happens when a
 * heading opens a part and the block after it is heavier than `maxWeight`: the
 * heading is flushed on its own, and a part that is *just* a heading is the
 * worst version of the orphan this exists to prevent. Emptied parts are dropped
 * by the filter below.
 */
export function rebalanceOrphanHeadings(parts: RootContent[][]): RootContent[][] {
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i]
    while (part.length > 0 && part[part.length - 1].type === 'heading') {
      parts[i + 1].unshift(part.pop() as RootContent)
    }
  }
  return parts.filter((part) => part.length > 0)
}
