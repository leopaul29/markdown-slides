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

interface SearchableText {
  text: string
  lower: string
  titleLower: string
}

/**
 * Collapsing whitespace and lower-casing a whole document on every keystroke is
 * the expensive part of searching, and the result never changes for a given
 * slide — so it is derived once and kept for as long as the slide lives.
 */
const cache = new WeakMap<Slide, SearchableText>()

function searchable(slide: Slide): SearchableText {
  const cached = cache.get(slide)
  if (cached) return cached
  const text = slide.text.replace(/\s+/g, ' ').trim()
  const derived: SearchableText = {
    text,
    lower: text.toLowerCase(),
    titleLower: slide.title.toLowerCase(),
  }
  cache.set(slide, derived)
  return derived
}

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
    const result = matchInSlide(slide, needle)
    if (!result) continue
    if (result.titleMatch) titleHits.push(result)
    else if (bodyHits.length < limit) bodyHits.push(result)
    // Heading matches outrank body matches, so the scan may only stop once
    // enough of them exist — otherwise a later title hit would be lost.
    if (titleHits.length >= limit) break
  }

  return [...titleHits, ...bodyHits].slice(0, limit)
}

function matchInSlide(slide: Slide, needle: string): SearchResult | null {
  const { text, lower, titleLower } = searchable(slide)
  const titleMatch = titleLower.includes(needle)
  const at = lower.indexOf(needle)

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
