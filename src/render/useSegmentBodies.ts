import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react'
import type { DocumentModel, Segment } from '../engine'
import { nodesToHtml } from './html'
import { applyLineNumbers, enhanceSegmentBody } from './enhance'

/**
 * Fills `[data-index]` bodies with rendered segment HTML, once each.
 *
 * Shared by every HTML view, because the two hard-won rules here are the same
 * whatever the view:
 *
 * 1. HTML is injected imperatively, never through `dangerouslySetInnerHTML` —
 *    React re-sets that property on every render even when the string is
 *    byte-identical, which throws away the DOM enhancements below.
 * 2. Because React reuses those DOM nodes when the document changes, the fill
 *    markers have to be wiped explicitly. That is the first effect, declared
 *    before the fill so it runs first.
 *
 * Rendering is also the expensive half of opening a document, so a body is only
 * converted when the view says it is `rendered`, and the result is cached for
 * the model's lifetime.
 */
export function useSegmentBodies(
  rootRef: RefObject<HTMLElement | null>,
  model: DocumentModel,
  rendered: ReadonlySet<number>,
  lineNumbers: boolean,
  /**
   * For a scrolling view: the element the reader is looking at. A body that
   * fills in above it grows from its placeholder height to its real one, which
   * would slide the page under them — so the container is scrolled by whatever
   * the anchor moved. Views that do not scroll as one page leave it out.
   */
  anchor?: () => HTMLElement | null,
): void {
  const htmlCache = useRef(new Map<number, string>())
  const anchorRef = useRef(anchor)
  anchorRef.current = anchor

  const htmlFor = useCallback((segment: Segment): string => {
    const cached = htmlCache.current.get(segment.index)
    if (cached !== undefined) return cached
    const html = nodesToHtml(segment.nodes)
    htmlCache.current.set(segment.index, html)
    return html
  }, [])

  useLayoutEffect(() => {
    htmlCache.current = new Map()
    for (const body of bodies(rootRef.current)) {
      body.innerHTML = ''
      delete body.dataset.filled
    }
  }, [model, rootRef])

  useLayoutEffect(() => {
    const root = rootRef.current
    const anchored = anchorRef.current?.() ?? null
    const before = anchored && root ? topWithin(root, anchored) : null

    for (const body of bodies(root)) {
      const index = Number(body.dataset.index)
      const segment = model.segments[index]
      if (!segment || !rendered.has(index)) continue
      if (body.dataset.filled !== 'true') {
        body.innerHTML = htmlFor(segment)
        body.dataset.filled = 'true'
        enhanceSegmentBody(body)
      }
      applyLineNumbers(body, lineNumbers)
    }

    if (root && anchored && before !== null) {
      const drift = topWithin(root, anchored) - before
      if (Math.abs(drift) > 1) root.scrollTop += drift
    }
  }, [model, rendered, lineNumbers, htmlFor, rootRef])
}

function bodies(root: HTMLElement | null): HTMLElement[] {
  return root ? Array.from(root.querySelectorAll<HTMLElement>('.segment-body')) : []
}

/** Where `element` sits relative to the top of its scrolling container. */
function topWithin(root: HTMLElement, element: HTMLElement): number {
  return element.getBoundingClientRect().top - root.getBoundingClientRect().top
}

/**
 * Placeholder height for a body that has not been rendered yet, so a long
 * document has a believable scrollbar before it is all in the DOM. Derived from
 * the segment's own text — deterministic, and it measures nothing.
 */
export function estimateHeight(segment: Segment): string {
  const lines = Math.ceil(segment.text.length / 90) + segment.nodes.length
  return `${Math.min(Math.max(lines * 1.7, 6), 80)}rem`
}

/** Opens a view with the first few segments already rendered. */
export function initialWindow(model: DocumentModel, radius: number): Set<number> {
  const window = new Set<number>()
  for (let i = 0; i <= radius && i < model.segments.length; i += 1) window.add(i)
  return window
}

/**
 * State updater that adds `index` and its neighbours to the rendered set, and
 * returns the set unchanged when they are all in it already — an identical set
 * short-circuits the re-render.
 */
export function expandRendered(
  index: number,
  radius: number,
  count: number,
): (previous: Set<number>) => Set<number> {
  return (previous) => {
    let next: Set<number> | null = null
    for (let i = index - radius; i <= index + radius; i += 1) {
      if (i >= 0 && i < count && !previous.has(i)) {
        next ??= new Set(previous)
        next.add(i)
      }
    }
    return next ?? previous
  }
}
