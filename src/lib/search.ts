import type { Deck, Slide } from './slides'

/** A run of characters that is either part of a match or ordinary text. */
export interface SearchSegment {
  text: string
  match: boolean
}

export interface SearchResult {
  slide: Slide
  /** The slide title, split so the matched characters can be highlighted. */
  title: SearchSegment[]
  /** Snippet around the best body match, split the same way. */
  snippet: SearchSegment[]
  /** Ranking score. Higher is better; a pure function of the deck and query. */
  score: number
}

/** One whitespace-separated word of the query, or one `"quoted phrase"`. */
export interface QueryTerm {
  /** Lower-cased text to look for. */
  text: string
  /** Quoted terms are matched literally — never fuzzily. */
  phrase: boolean
}

const SNIPPET_RADIUS = 60
/** Beyond this the query stops narrowing and only costs time. */
const MAX_TERMS = 8
/** Fuzzy matching is quadratic-ish in the title length, so bound it. */
const MAX_TITLE_SCAN = 240
/** Below this length a subsequence match is noise rather than a typo. */
const MIN_FUZZY_TERM = 3
const MIN_FUZZY_QUALITY = 0.35
/** All body terms inside this many characters counts as one passage. */
const PROXIMITY_WINDOW = 240
/** Guard against highlighting a term that occurs hundreds of times. */
const MAX_HIGHLIGHTS_PER_TERM = 20

/*
 * Ranking weights. The ordering they encode, strongest first:
 * a term in the title beats a term in the body; a term that starts a word
 * beats one buried inside another word; an exact match beats a fuzzy one;
 * a query whose terms all land in one passage beats one whose terms are
 * scattered across the slide.
 */
const TITLE_EXACT = 1000
const TITLE_BOUNDARY_BONUS = 300
const TITLE_PREFIX_BONUS = 200
const TITLE_FUZZY_MAX = 500
const BODY_EXACT = 100
const BODY_BOUNDARY_BONUS = 40
const ALL_TERMS_IN_TITLE_BONUS = 250
const PROXIMITY_BONUS = 120

interface SearchableText {
  text: string
  lower: string
  title: string
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
    title: slide.title,
    titleLower: slide.title.toLowerCase(),
  }
  cache.set(slide, derived)
  return derived
}

/**
 * Splits a query into terms. Whitespace separates terms and every term must
 * match (they narrow, they do not widen); double quotes group words into a
 * single literal phrase.
 */
export function parseQuery(query: string): QueryTerm[] {
  const terms: QueryTerm[] = []
  const pattern = /"([^"]*)"|(\S+)/g
  let match: RegExpExecArray | null

  while ((match = pattern.exec(query)) !== null) {
    if (terms.length >= MAX_TERMS) break
    const quoted = match[1] !== undefined
    const text = (match[1] ?? match[2]).trim().replace(/\s+/g, ' ').toLowerCase()
    if (text === '') continue
    if (terms.some((term) => term.text === text)) continue
    terms.push({ text, phrase: quoted })
  }

  return terms
}

/**
 * Search over headings, paragraphs, lists, tables and code.
 *
 * Every term must be found somewhere in the slide, in the title or in the body.
 * Titles additionally accept a fuzzy (subsequence) match, so `authn` finds
 * "Authentication" — the body does not, because in a long paragraph a
 * subsequence match means nothing.
 *
 * Linear over the slide list, then a sort: instant for documents far larger
 * than the 10k-line target.
 */
export function searchDeck(deck: Deck, query: string, limit = 40): SearchResult[] {
  const terms = parseQuery(query)
  if (terms.length === 0) return []

  const matches: Match[] = []
  for (const slide of deck.slides) {
    const match = matchInSlide(slide, terms)
    if (match) matches.push(match)
  }

  // Reading order breaks ties, so equally good matches keep document order.
  matches.sort((a, b) => b.score - a.score || a.slide.index - b.slide.index)
  // Snippets are the expensive half and only the visible results need one.
  return matches.slice(0, limit).map((match) => present(match, terms))
}

/** A scored hit, before the work of rendering it has been paid for. */
interface Match {
  slide: Slide
  score: number
  titleRanges: Range[]
  /** Where each term first occurs in the body; empty for a title-only hit. */
  bodyAnchors: Range[]
}

function present(match: Match, terms: QueryTerm[]): SearchResult {
  const { text, lower, title } = searchable(match.slide)
  return {
    slide: match.slide,
    title: toSegments(title, match.titleRanges),
    snippet: buildSnippet(text, lower, terms, match.bodyAnchors),
    score: match.score,
  }
}

function matchInSlide(slide: Slide, terms: QueryTerm[]): Match | null {
  const { lower, titleLower } = searchable(slide)
  const titleRanges: Range[] = []
  const bodyAnchors: Range[] = []
  let score = 0
  let titleTerms = 0

  for (const term of terms) {
    let termScore = 0

    const titleHit = matchTitle(titleLower, term, titleRanges)
    if (titleHit > 0) {
      termScore += titleHit
      titleTerms += 1
    }

    const bodyAt = lower.indexOf(term.text)
    if (bodyAt !== -1) {
      termScore += BODY_EXACT + (startsWord(lower, bodyAt) ? BODY_BOUNDARY_BONUS : 0)
      bodyAnchors.push({ start: bodyAt, end: bodyAt + term.text.length })
    }

    // Every term must land somewhere: terms narrow the result set.
    if (termScore === 0) return null
    score += termScore
  }

  if (titleTerms === terms.length) score += ALL_TERMS_IN_TITLE_BONUS
  if (bodyAnchors.length === terms.length && span(bodyAnchors) <= PROXIMITY_WINDOW) {
    score += PROXIMITY_BONUS
  }

  return { slide, score, titleRanges, bodyAnchors }
}

/** Scores one term against the title and records what to highlight. */
function matchTitle(titleLower: string, term: QueryTerm, ranges: Range[]): number {
  const at = titleLower.indexOf(term.text)
  if (at !== -1) {
    ranges.push({ start: at, end: at + term.text.length })
    return (
      TITLE_EXACT +
      (startsWord(titleLower, at) ? TITLE_BOUNDARY_BONUS : 0) +
      (at === 0 ? TITLE_PREFIX_BONUS : 0)
    )
  }

  if (term.phrase || term.text.length < MIN_FUZZY_TERM) return 0
  const fuzzy = fuzzyMatch(titleLower.slice(0, MAX_TITLE_SCAN), term.text)
  if (!fuzzy) return 0

  for (const index of fuzzy.indices) ranges.push({ start: index, end: index + 1 })
  return Math.round(TITLE_FUZZY_MAX * fuzzy.quality)
}

/* ------------------------------------------------------------------ snippets */

/**
 * Picks the window of body text that covers the most terms, then highlights
 * every occurrence of every term inside it.
 */
function buildSnippet(
  text: string,
  lower: string,
  terms: QueryTerm[],
  anchors: Range[],
): SearchSegment[] {
  if (anchors.length === 0) {
    // Title-only match: show the opening of the slide for context.
    return toSegments(text.slice(0, SNIPPET_RADIUS * 2), [])
  }

  let start = 0
  let end = 0
  let covered = -1
  for (const anchor of anchors) {
    const from = snapStart(text, Math.max(0, anchor.start - SNIPPET_RADIUS))
    const to = snapEnd(text, Math.min(text.length, anchor.end + SNIPPET_RADIUS))
    const inside = anchors.filter((other) => other.start >= from && other.end <= to).length
    if (inside > covered || (inside === covered && from < start)) {
      start = from
      end = to
      covered = inside
    }
  }

  const lead = start > 0 ? '…' : ''
  const tail = end < text.length ? '…' : ''
  const window = lead + text.slice(start, end) + tail

  const ranges: Range[] = []
  for (const term of terms) {
    let at = lower.indexOf(term.text, start)
    for (let found = 0; at !== -1 && at < end && found < MAX_HIGHLIGHTS_PER_TERM; found += 1) {
      ranges.push({
        start: at - start + lead.length,
        end: Math.min(at + term.text.length, end) - start + lead.length,
      })
      at = lower.indexOf(term.text, at + term.text.length)
    }
  }

  return toSegments(window, ranges)
}

/** Grows a snippet edge outwards to the nearest word boundary. */
function snapStart(text: string, at: number): number {
  if (at === 0) return 0
  const space = text.lastIndexOf(' ', at)
  return space === -1 ? 0 : space + 1
}

function snapEnd(text: string, at: number): number {
  if (at >= text.length) return text.length
  const space = text.indexOf(' ', at)
  return space === -1 ? text.length : space
}

/* -------------------------------------------------------------------- ranges */

interface Range {
  start: number
  end: number
}

function span(ranges: Range[]): number {
  let low = Infinity
  let high = -Infinity
  for (const range of ranges) {
    if (range.start < low) low = range.start
    if (range.end > high) high = range.end
  }
  return high - low
}

function mergeRanges(ranges: Range[]): Range[] {
  if (ranges.length === 0) return []
  const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end)
  const merged: Range[] = [{ ...sorted[0] }]
  for (let i = 1; i < sorted.length; i += 1) {
    const last = merged[merged.length - 1]
    if (sorted[i].start <= last.end) last.end = Math.max(last.end, sorted[i].end)
    else merged.push({ ...sorted[i] })
  }
  return merged
}

/** Splits text into highlighted and plain runs, so React can render it safely. */
function toSegments(text: string, ranges: Range[]): SearchSegment[] {
  const segments: SearchSegment[] = []
  let at = 0

  for (const range of mergeRanges(ranges)) {
    const start = Math.max(at, Math.min(range.start, text.length))
    const end = Math.max(start, Math.min(range.end, text.length))
    if (start > at) segments.push({ text: text.slice(at, start), match: false })
    if (end > start) segments.push({ text: text.slice(start, end), match: true })
    at = end
  }
  if (at < text.length) segments.push({ text: text.slice(at), match: false })

  return segments
}

/* --------------------------------------------------------------------- fuzzy */

const MATCH_BASE = 3
const BOUNDARY_BONUS = 5
const CONSECUTIVE_BONUS = 4
const GAP_PENALTY = 1
/** A tiny nudge towards the earliest of two otherwise identical matches. */
const START_PENALTY = 0.1

interface FuzzyMatch {
  /** 0…1, where 1 is the term appearing verbatim at the start of a word. */
  quality: number
  /** Position in `text` of each character of the term. */
  indices: number[]
}

/**
 * Best-scoring subsequence match of `term` inside `text`, both lower-cased.
 *
 * Scored so that adjacent characters and characters starting a word are worth
 * more than scattered ones, which is what makes `authn` prefer
 * "Auth·enticatio·n" over a coincidental spread of the same letters. The inner
 * loop keeps a running maximum, so the whole thing is linear in
 * `text.length × term.length`.
 *
 * Note that this deliberately accepts initials: `adr` matches
 * "Architecture Decision Records", because jumping to the start of a later word
 * is free while skipping letters inside a word is not. A fuzzy hit never
 * outranks an exact one, so the looser matches stay below the literal ones.
 */
export function fuzzyMatch(text: string, term: string): FuzzyMatch | null {
  const n = text.length
  const m = term.length
  if (m === 0 || m > n) return null
  // Almost every slide in a document fails this, and it costs one pass.
  if (!hasSubsequence(text, term)) return null

  const NONE = -Infinity
  const scratch = reserve(n, m)
  let previous = scratch.a
  let row = scratch.b
  const backlinks = scratch.back
  previous.fill(NONE, 0, n)

  for (let j = 0; j < m; j += 1) {
    row.fill(NONE, 0, n)
    const back = backlinks.subarray(j * n, (j + 1) * n)
    back.fill(-1)
    const char = term[j]
    // Maximum of `previous[k] + k * GAP_PENALTY` over every k seen so far,
    // which is what lets the gap penalty be applied without an inner scan.
    let best = NONE
    let bestAt = -1

    for (let i = 0; i < n; i += 1) {
      if (i > 0 && previous[i - 1] !== NONE) {
        const candidate = previous[i - 1] + (i - 1) * GAP_PENALTY
        if (candidate > best) {
          best = candidate
          bestAt = i - 1
        }
      }
      if (text[i] !== char) continue

      const base = MATCH_BASE + (startsWord(text, i) ? BOUNDARY_BONUS : 0)
      if (j === 0) {
        row[i] = base - i * START_PENALTY
        continue
      }
      if (bestAt === -1) continue

      let score = best - (i - 1) * GAP_PENALTY + base
      let from = bestAt
      if (previous[i - 1] !== NONE) {
        const adjacent = previous[i - 1] + base + CONSECUTIVE_BONUS
        if (adjacent > score) {
          score = adjacent
          from = i - 1
        }
      }
      row[i] = score
      back[i] = from
    }

    const spent = previous
    previous = row
    row = spent
  }

  let score = NONE
  let at = -1
  for (let i = 0; i < n; i += 1) {
    if (previous[i] > score) {
      score = previous[i]
      at = i
    }
  }
  if (at === -1) return null

  const indices = new Array<number>(m)
  for (let j = m - 1; j >= 0; j -= 1) {
    indices[j] = at
    at = backlinks[j * n + at]
    if (j > 0 && at === -1) return null
  }

  const quality = qualityOf(text, indices)
  return quality >= MIN_FUZZY_QUALITY ? { quality, indices } : null
}

/**
 * How good the chosen match is, on its own terms — the search score above is
 * only a way of *choosing* between candidate matches, and its gap penalties
 * make any match in a long title look bad. Rated here instead against what a
 * perfect match of the same length would earn, and charging only for letters
 * skipped *inside* a word: jumping to the start of the next word is what
 * "adr" → "Architecture Decision Records" does, and it is not a defect.
 */
function qualityOf(text: string, indices: number[]): number {
  const m = indices.length
  let score = MATCH_BASE * m

  for (let j = 0; j < m; j += 1) {
    const boundary = startsWord(text, indices[j])
    if (boundary) score += BOUNDARY_BONUS
    if (j === 0) continue
    const gap = indices[j] - indices[j - 1] - 1
    if (gap === 0) score += CONSECUTIVE_BONUS
    else if (!boundary) score -= gap * GAP_PENALTY
  }

  const perfect = m * (MATCH_BASE + BOUNDARY_BONUS) + (m - 1) * CONSECUTIVE_BONUS
  return Math.min(1, Math.max(0, score / perfect))
}

/**
 * Is `term` a subsequence of `text` at all? A greedy left-to-right scan answers
 * that exactly — it can only fail when no match exists — for the cost of one
 * pass, which is what keeps the matrix below off the hot path. Nearly every
 * slide in a document is rejected here.
 */
function hasSubsequence(text: string, term: string): boolean {
  let at = 0
  for (let j = 0; j < term.length; j += 1) {
    at = text.indexOf(term[j], at)
    if (at === -1) return false
    at += 1
  }
  return true
}

/*
 * `fuzzyMatch` runs once per slide per keystroke, so its working memory is
 * reused rather than reallocated: three buffers grown to the largest title and
 * term seen so far. Safe because the matcher is synchronous and never nested.
 */
const scratch = {
  a: new Float64Array(0),
  b: new Float64Array(0),
  back: new Int32Array(0),
}

function reserve(n: number, m: number): typeof scratch {
  if (scratch.a.length < n) {
    scratch.a = new Float64Array(n)
    scratch.b = new Float64Array(n)
  }
  if (scratch.back.length < n * m) scratch.back = new Int32Array(n * m)
  return scratch
}

const WORD_CHAR = /[\p{L}\p{N}]/u

/** True when the character at `at` begins a word rather than continuing one. */
function startsWord(text: string, at: number): boolean {
  return at === 0 || !WORD_CHAR.test(text[at - 1])
}
