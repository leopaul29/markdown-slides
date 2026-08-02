import type { Deck, Slide } from './slides'

export interface SearchResult {
  slide: Slide
  /** Snippet split around the match so React can highlight it without HTML. */
  before: string
  match: string
  after: string
  titleMatch: boolean
}

const SNIPPET_RADIUS = 60

/**
 * Plain substring search over headings, paragraphs, lists, tables and code.
 * Linear over the slide list, which stays instant for documents far larger
 * than the 10k-line target.
 */
export function searchDeck(deck: Deck, query: string, limit = 40): SearchResult[] {
  const needle = query.trim().toLowerCase()
  if (needle.length === 0) return []

  const titleHits: SearchResult[] = []
  const bodyHits: SearchResult[] = []

  for (const slide of deck.slides) {
    const titleMatch = slide.title.toLowerCase().includes(needle)
    const result = matchInText(slide, needle, titleMatch)
    if (!result) continue
    ;(titleMatch ? titleHits : bodyHits).push(result)
    if (titleHits.length + bodyHits.length >= limit * 2) break
  }

  return [...titleHits, ...bodyHits].slice(0, limit)
}

function matchInText(slide: Slide, needle: string, titleMatch: boolean): SearchResult | null {
  const text = slide.text.replace(/\s+/g, ' ').trim()
  const at = text.toLowerCase().indexOf(needle)

  if (at === -1) {
    if (!titleMatch) return null
    return {
      slide,
      before: '',
      match: '',
      after: text.slice(0, SNIPPET_RADIUS * 2),
      titleMatch,
    }
  }

  const start = Math.max(0, at - SNIPPET_RADIUS)
  const end = Math.min(text.length, at + needle.length + SNIPPET_RADIUS)
  return {
    slide,
    before: (start > 0 ? '…' : '') + text.slice(start, at),
    match: text.slice(at, at + needle.length),
    after: text.slice(at + needle.length, end) + (end < text.length ? '…' : ''),
    titleMatch,
  }
}
