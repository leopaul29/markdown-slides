import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import Reveal from 'reveal.js/dist/reveal.esm.js'
import type { RevealApi } from 'reveal.js/dist/reveal.esm.js'
import type { DocumentModel, Segment } from '../engine'
import { expandRendered, initialWindow, useSegmentBodies } from '../render/useSegmentBodies'
import type { ViewHandle, ViewProps } from './view'

/** How many segments on each side of the current one are rendered ahead of time. */
const PRELOAD_RADIUS = 2

/**
 * The presentation view: Reveal.js driven by the document model.
 *
 * Reveal's horizontal axis is one section, its vertical axis the parts of that
 * section. The model does not carry those coordinates — they are derived here,
 * which is the whole point of the split: a section is a model idea, a column is
 * Reveal's.
 */
export const Deck = forwardRef<ViewHandle, ViewProps>(function Deck(
  { model, lineNumbers, onSegmentChange, onImageClick },
  ref,
) {
  const rootRef = useRef<HTMLDivElement>(null)
  const revealRef = useRef<RevealApi | null>(null)
  /**
   * A jump requested before Reveal finished initializing, tagged with the model
   * it was meant for: a jump queued for one document must never replay against
   * the next. Tagging rather than clearing on teardown, because React remounts
   * this component without warning (StrictMode does it on every mount) and the
   * reader's position would be thrown away with it.
   */
  const pendingJump = useRef<{ model: DocumentModel; index: number } | null>(null)
  const [rendered, setRendered] = useState<Set<number>>(() =>
    initialWindow(model, PRELOAD_RADIUS),
  )

  useSegmentBodies(rootRef, model, rendered, lineNumbers)

  // Rendering every segment up front is what makes huge documents feel slow, so
  // bodies are only converted to HTML once they come within reach.
  const preload = useCallback(
    (index: number) => {
      setRendered(expandRendered(index, PRELOAD_RADIUS, model.segments.length))
    },
    [model],
  )

  useEffect(() => {
    setRendered(initialWindow(model, PRELOAD_RADIUS))
  }, [model])

  // Kept in a ref so that a new callback identity never re-initializes Reveal.
  const onSegmentChangeRef = useRef(onSegmentChange)
  useEffect(() => {
    onSegmentChangeRef.current = onSegmentChange
  }, [onSegmentChange])

  useEffect(() => {
    const element = rootRef.current
    if (!element) return

    const instance = new Reveal(element, {
      embedded: true,
      disableLayout: true,
      center: false,
      hash: false,
      respondToHashChanges: false,
      controls: true,
      controlsTutorial: false,
      progress: true,
      slideNumber: 'c/t',
      keyboard: true,
      overview: true,
      fragments: false,
      transition: 'slide',
      transitionSpeed: 'fast',
      backgroundTransition: 'none',
      touch: true,
    })

    let disposed = false
    const handleChange = (event: { indexh: number; indexv: number }) => {
      const section = model.sections[event.indexh]
      const index = section?.segments[event.indexv ?? 0]
      if (index === undefined) return
      preload(index)
      onSegmentChangeRef.current(index)
    }

    // The ref is published only once Reveal is ready: navigation calls made
    // before that (a TOC click during startup) would hit an uninitialized deck.
    void instance.initialize().then(() => {
      if (disposed) return
      instance.on('slidechanged', handleChange)
      revealRef.current = instance

      // Replay a jump requested while the deck was still starting up.
      const pending = pendingJump.current
      pendingJump.current = null
      const pendingSegment = pending?.model === model ? model.segments[pending.index] : undefined
      if (pendingSegment) {
        const [h, v] = coordsOf(pendingSegment)
        instance.slide(h, v)
      } else {
        /*
         * Reveal reads `location.hash` on startup whatever `hash: false` says,
         * and the app's own `#/12` fragment is in exactly the format Reveal
         * parses — so without this it would silently open at horizontal slide
         * 12. The app owns the position; the deck starts at the beginning
         * unless it was told otherwise.
         */
        instance.slide(0, 0)
      }

      const { h, v } = instance.getIndices()
      handleChange({ indexh: h, indexv: v })
    })

    return () => {
      disposed = true
      revealRef.current = null
      try {
        instance.destroy()
      } catch {
        /* Reveal throws if it never finished initializing; nothing to clean. */
      }
    }
  }, [model, preload])

  useImperativeHandle(
    ref,
    () => ({
      goTo(index) {
        const segment = model.segments[index]
        if (!segment) return
        preload(index)
        const [h, v] = coordsOf(segment)
        if (revealRef.current) revealRef.current.slide(h, v)
        else pendingJump.current = { model, index }
      },
      toggleOverview() {
        revealRef.current?.toggleOverview()
      },
    }),
    [model, preload],
  )

  useEffect(() => {
    const element = rootRef.current
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

  const renderSlide = (segment: Segment) => (
    <section key={segment.index} data-segment-index={segment.index}>
      <div className="slide-inner">
        <article className="slide-content">
          {segment.title ? (
            <header className="segment-head">
              <div>
                {segment.group ? <div className="segment-eyebrow">{segment.group}</div> : null}
                <h2 className={segment.level === 1 ? 'segment-title' : 'segment-title sub'}>
                  {segment.title}
                </h2>
              </div>
              {segment.partCount > 1 ? (
                <span className="segment-part">
                  {segment.part}/{segment.partCount}
                </span>
              ) : null}
            </header>
          ) : null}
          {/* Filled by `useSegmentBodies`; React must not own its children. */}
          <div className="segment-body md" data-index={segment.index} />
        </article>
      </div>
    </section>
  )

  return (
    <div className="reveal" ref={rootRef}>
      <div className="slides">
        {model.sections.map((section) =>
          section.segments.length === 1 ? (
            renderSlide(model.segments[section.segments[0]])
          ) : (
            <section key={`stack-${section.index}`}>
              {section.segments.map((index) => renderSlide(model.segments[index]))}
            </section>
          ),
        )}
      </div>
    </div>
  )
})

/** Reveal's horizontal / vertical coordinates for a segment. */
function coordsOf(segment: Segment): [number, number] {
  return [segment.section, segment.part - 1]
}
