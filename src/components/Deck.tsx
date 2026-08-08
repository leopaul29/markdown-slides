import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import Reveal from 'reveal.js/dist/reveal.esm.js'
import type { RevealApi } from 'reveal.js/dist/reveal.esm.js'
import type { Deck as DeckModel, Slide } from '../lib/slides'
import { nodesToHtml } from '../lib/markdown'
import { applyLineNumbers, enhanceSlideBody } from '../lib/enhance'

export interface DeckHandle {
  goTo(index: number): void
  toggleOverview(): void
}

interface DeckProps {
  deck: DeckModel
  lineNumbers: boolean
  onSlideChange: (index: number) => void
  onImageClick: (src: string, alt: string) => void
}

/** How many slides on each side of the current one are rendered ahead of time. */
const PRELOAD_RADIUS = 2

export const Deck = forwardRef<DeckHandle, DeckProps>(function Deck(
  { deck, lineNumbers, onSlideChange, onImageClick },
  ref,
) {
  const rootRef = useRef<HTMLDivElement>(null)
  const revealRef = useRef<RevealApi | null>(null)
  /** A jump requested before Reveal finished initializing. */
  const pendingIndex = useRef<number | null>(null)
  const htmlCache = useRef(new Map<number, string>())
  const [rendered, setRendered] = useState<Set<number>>(() => initialWindow(deck))

  // Rendering every slide up front is what makes huge documents feel slow, so
  // slide bodies are only converted to HTML once they come within reach.
  const preload = useCallback(
    (index: number) => {
      setRendered((previous) => {
        const next = new Set(previous)
        let changed = false
        for (let i = index - PRELOAD_RADIUS; i <= index + PRELOAD_RADIUS; i += 1) {
          if (i >= 0 && i < deck.slides.length && !next.has(i)) {
            next.add(i)
            changed = true
          }
        }
        return changed ? next : previous
      })
    },
    [deck],
  )

  const htmlFor = useCallback(
    (slide: Slide): string => {
      const cached = htmlCache.current.get(slide.index)
      if (cached !== undefined) return cached
      const html = nodesToHtml(slide.nodes)
      htmlCache.current.set(slide.index, html)
      return html
    },
    [],
  )

  // A new document reuses the same DOM nodes, so clear what the previous one
  // left behind. Declared first so it runs before the fill effect below.
  useLayoutEffect(() => {
    htmlCache.current = new Map()
    for (const body of bodies(rootRef.current)) {
      body.innerHTML = ''
      delete body.dataset.filled
    }
  }, [deck])

  useEffect(() => {
    setRendered(initialWindow(deck))
  }, [deck])

  /*
   * Slide HTML is injected directly rather than through
   * `dangerouslySetInnerHTML`: React re-writes that property on every render,
   * which would throw away the code-block and table wrappers added below.
   */
  useLayoutEffect(() => {
    for (const body of bodies(rootRef.current)) {
      const index = Number(body.dataset.index)
      const slide = deck.slides[index]
      if (!slide || !rendered.has(index)) continue
      if (body.dataset.filled !== 'true') {
        body.innerHTML = htmlFor(slide)
        body.dataset.filled = 'true'
        enhanceSlideBody(body)
      }
      applyLineNumbers(body, lineNumbers)
    }
  }, [deck, rendered, lineNumbers, htmlFor])

  // Kept in a ref so that a new callback identity never re-initializes Reveal.
  const onSlideChangeRef = useRef(onSlideChange)
  useEffect(() => {
    onSlideChangeRef.current = onSlideChange
  }, [onSlideChange])

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
      const slide = deck.columns[event.indexh]?.[event.indexv ?? 0]
      if (!slide) return
      preload(slide.index)
      onSlideChangeRef.current(slide.index)
    }

    // The ref is published only once Reveal is ready: navigation calls made
    // before that (a TOC click during startup) would hit an uninitialized deck.
    void instance.initialize().then(() => {
      if (disposed) return
      instance.on('slidechanged', handleChange)
      revealRef.current = instance

      // Replay a jump requested while the deck was still starting up.
      const pending = pendingIndex.current
      pendingIndex.current = null
      const pendingSlide = pending !== null ? deck.slides[pending] : undefined
      if (pendingSlide) {
        const [h, v] = coordsOf(deck, pendingSlide)
        instance.slide(h, v)
      }

      const { h, v } = instance.getIndices()
      handleChange({ indexh: h, indexv: v })
    })

    return () => {
      disposed = true
      revealRef.current = null
      // A jump queued for this deck must not be replayed against the next one.
      pendingIndex.current = null
      try {
        instance.destroy()
      } catch {
        /* Reveal throws if it never finished initializing; nothing to clean. */
      }
    }
  }, [deck, preload])

  useImperativeHandle(
    ref,
    () => ({
      goTo(index) {
        const slide = deck.slides[index]
        if (!slide) return
        preload(index)
        const [h, v] = coordsOf(deck, slide)
        if (revealRef.current) revealRef.current.slide(h, v)
        else pendingIndex.current = index
      },
      toggleOverview() {
        revealRef.current?.toggleOverview()
      },
    }),
    [deck, preload],
  )

  useEffect(() => {
    const element = rootRef.current
    if (!element) return
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (target.tagName === 'IMG' && target.closest('.slide-body')) {
        const image = target as HTMLImageElement
        onImageClick(image.currentSrc || image.src, image.alt)
      }
    }
    element.addEventListener('click', onClick)
    return () => element.removeEventListener('click', onClick)
  }, [onImageClick])

  const renderSlide = (slide: Slide) => (
    <section key={slide.index} data-slide-index={slide.index}>
      <div className="slide-inner">
        <article className="slide-content">
          {slide.title ? (
            <header className="slide-head">
              <div>
                {slide.group ? <div className="slide-eyebrow">{slide.group}</div> : null}
                <h2 className={slide.level === 1 ? 'slide-title' : 'slide-title sub'}>
                  {slide.title}
                </h2>
              </div>
              {slide.partCount > 1 ? (
                <span className="slide-part">
                  {slide.part}/{slide.partCount}
                </span>
              ) : null}
            </header>
          ) : null}
          {/* Filled by the layout effect above; React must not own its children. */}
          <div className="slide-body md" data-index={slide.index} />
        </article>
      </div>
    </section>
  )

  return (
    <div className="reveal" ref={rootRef}>
      <div className="slides">
        {deck.columns.map((column, h) =>
          column.length === 1 ? (
            renderSlide(column[0])
          ) : (
            <section key={`stack-${h}`}>{column.map(renderSlide)}</section>
          ),
        )}
      </div>
    </div>
  )
})

/**
 * Reveal's horizontal / vertical coordinates for a slide. The model does not
 * carry them: a section is one column, and its parts stack inside it.
 */
function coordsOf(deck: DeckModel, slide: Slide): [number, number] {
  const h = deck.columns.findIndex((column) => column[0]?.index === slide.index - (slide.part - 1))
  return [Math.max(h, 0), slide.part - 1]
}

function bodies(root: HTMLElement | null): HTMLElement[] {
  return root ? Array.from(root.querySelectorAll<HTMLElement>('.slide-body')) : []
}

function initialWindow(deck: DeckModel): Set<number> {
  const window = new Set<number>()
  for (let i = 0; i <= PRELOAD_RADIUS && i < deck.slides.length; i += 1) window.add(i)
  return window
}
