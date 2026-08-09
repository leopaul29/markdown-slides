import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import {
  estimateHeight,
  expandRendered,
  initialWindow,
  useSegmentBodies,
} from '../render/useSegmentBodies'
import type { ViewHandle, ViewProps } from './view'

/** Segments rendered on each side of one that comes into view. */
const PRELOAD_RADIUS = 1
/** How far outside the viewport a segment starts rendering. */
const PRELOAD_MARGIN = '800px'
/**
 * The band at the top of the viewport that decides "where am I". A segment
 * counts as current while any of it overlaps the top fifth of the page, which
 * is where a reader's eye actually is.
 */
const POSITION_BAND = '0px 0px -80% 0px'

/**
 * The book view: the whole document as one scrolling page.
 *
 * Same model as the presentation, read differently. Sections keep their
 * headings and their parts flow into one another, because a page break is a
 * presentation idea — the parts exist here only as the unit of lazy rendering
 * and of position.
 */
export const BookView = forwardRef<ViewHandle, ViewProps>(function BookView(
  { model, lineNumbers, onSegmentChange, onImageClick },
  ref,
) {
  const scrollRef = useRef<HTMLDivElement>(null)
  /** The segment the reader is on, and the one the page is anchored to. */
  const currentIndex = useRef(0)
  const [rendered, setRendered] = useState<Set<number>>(() =>
    initialWindow(model, PRELOAD_RADIUS),
  )

  useSegmentBodies(scrollRef, model, rendered, lineNumbers, () =>
    scrollRef.current?.querySelector<HTMLElement>(
      `[data-segment-index="${currentIndex.current}"]`,
    ) ?? null,
  )

  useEffect(() => {
    setRendered(initialWindow(model, PRELOAD_RADIUS))
  }, [model])

  const onSegmentChangeRef = useRef(onSegmentChange)
  useEffect(() => {
    onSegmentChangeRef.current = onSegmentChange
  }, [onSegmentChange])

  /*
   * Two observers rather than a scroll handler: one decides what to render
   * ahead of the reader, the other which segment they are actually on. Scroll
   * handlers would have to walk every segment on every frame; the observers do
   * the same work in the browser, off the main thread's hot path.
   */
  useEffect(() => {
    const root = scrollRef.current
    if (!root) return

    const articles = Array.from(root.querySelectorAll<HTMLElement>('[data-segment-index]'))

    const renderer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const index = Number((entry.target as HTMLElement).dataset.segmentIndex)
          setRendered(expandRendered(index, PRELOAD_RADIUS, model.segments.length))
        }
      },
      { root, rootMargin: `${PRELOAD_MARGIN} 0px ${PRELOAD_MARGIN} 0px` },
    )

    const visible = new Set<number>()
    const position = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = Number((entry.target as HTMLElement).dataset.segmentIndex)
          if (entry.isIntersecting) visible.add(index)
          else visible.delete(index)
        }
        if (visible.size === 0) return
        const top = Math.min(...visible)
        currentIndex.current = top
        onSegmentChangeRef.current(top)
      },
      { root, rootMargin: POSITION_BAND },
    )

    for (const article of articles) {
      renderer.observe(article)
      position.observe(article)
    }
    return () => {
      renderer.disconnect()
      position.disconnect()
    }
  }, [model])

  useImperativeHandle(
    ref,
    () => ({
      goTo(index) {
        const root = scrollRef.current
        if (!root || !model.segments[index]) return
        // Render the target before scrolling: a placeholder collapsing into
        // real content underneath the reader is what makes a jump feel broken.
        currentIndex.current = index
        setRendered(expandRendered(index, PRELOAD_RADIUS, model.segments.length))
        requestAnimationFrame(() => {
          const target = root.querySelector<HTMLElement>(`[data-segment-index="${index}"]`)
          if (!target) return
          // Measured rather than read from `offsetTop`, which is relative to
          // whichever ancestor happens to be positioned.
          const top =
            target.getBoundingClientRect().top -
            root.getBoundingClientRect().top +
            root.scrollTop
          root.scrollTo({ top, behavior: 'auto' })
          onSegmentChangeRef.current(index)
        })
      },
    }),
    [model],
  )

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (target.tagName === 'IMG' && target.closest('.segment-body')) {
        const image = target as HTMLImageElement
        onImageClick(image.currentSrc || image.src, image.alt)
      }
    }
    element.addEventListener('click', onClick)
    return () => element.removeEventListener('click', onClick)
  }, [onImageClick])

  // Page Up / Down, Home / End and the space bar scroll a container only when
  // it has focus, and nothing else in this view wants it.
  useEffect(() => {
    scrollRef.current?.focus({ preventScroll: true })
  }, [model])

  return (
    <div className="book" ref={scrollRef} tabIndex={-1}>
      <div className="book-page">
        {model.segments.map((segment) => (
          <article
            key={segment.index}
            className="book-segment"
            data-segment-index={segment.index}
            aria-label={segment.title || undefined}
          >
            {/* Only the first part carries the heading: the rest is one read. */}
            {segment.title && segment.part === 1 ? (
              <header className="segment-head">
                <div>
                  {segment.group ? <div className="segment-eyebrow">{segment.group}</div> : null}
                  <h2 className={segment.level === 1 ? 'segment-title' : 'segment-title sub'}>
                    {segment.title}
                  </h2>
                </div>
              </header>
            ) : null}
            <div
              className="segment-body md"
              data-index={segment.index}
              style={{ '--estimate': estimateHeight(segment) } as CSSProperties}
            />
          </article>
        ))}
      </div>
    </div>
  )
})
