import { describe, expect, it } from 'vitest'
import { buildDeck } from './slides'
import { fuzzyMatch, parseQuery, searchDeck, type SearchResult } from './search'

const doc = `# Authentication

Authentication is handled by Supabase Auth.

## Why

It reduces backend complexity.

## Alternatives

- Clerk
- Firebase Auth

# Database

PostgreSQL is the source of truth.
`

/** The highlighted runs of a result, which is what the palette shows in bold. */
function marks(segments: SearchResult['snippet']): string[] {
  return segments.filter((segment) => segment.match).map((segment) => segment.text)
}

function plain(segments: SearchResult['snippet']): string {
  return segments.map((segment) => segment.text).join('')
}

describe('query parsing', () => {
  it('splits on whitespace', () => {
    expect(parseQuery('backend complexity').map((term) => term.text)).toEqual([
      'backend',
      'complexity',
    ])
  })

  it('keeps a quoted phrase together and marks it literal', () => {
    expect(parseQuery('"source of truth" auth')).toEqual([
      { text: 'source of truth', phrase: true },
      { text: 'auth', phrase: false },
    ])
  })

  it('ignores empty and repeated terms', () => {
    expect(parseQuery('  auth   auth "" ').map((term) => term.text)).toEqual(['auth'])
  })
})

describe('search', () => {
  it('finds body text and reports the surrounding snippet', () => {
    const deck = buildDeck(doc)
    const [hit] = searchDeck(deck, 'firebase')
    expect(hit.slide.title).toBe('Alternatives')
    expect(marks(hit.snippet)).toEqual(['Firebase'])
  })

  it('ranks heading matches first', () => {
    const deck = buildDeck(doc)
    expect(searchDeck(deck, 'database')[0].slide.title).toBe('Database')
  })

  it('highlights the match inside the title too', () => {
    const [hit] = searchDeck(buildDeck(doc), 'data')
    expect(marks(hit.title)).toEqual(['Data'])
    expect(plain(hit.title)).toBe('Database')
  })

  it('returns nothing for an empty query', () => {
    expect(searchDeck(buildDeck(doc), '   ')).toEqual([])
  })

  it('is deterministic', () => {
    const deck = buildDeck(doc)
    const first = searchDeck(deck, 'auth')
    const second = searchDeck(deck, 'auth')
    expect(first.map((hit) => [hit.slide.index, hit.score])).toEqual(
      second.map((hit) => [hit.slide.index, hit.score]),
    )
  })
})

describe('multi-term queries', () => {
  const deck = buildDeck(doc)

  it('requires every term to match', () => {
    expect(searchDeck(deck, 'supabase auth').map((hit) => hit.slide.title)).toEqual([
      'Authentication',
    ])
    expect(searchDeck(deck, 'supabase postgresql')).toEqual([])
  })

  it('matches terms in any order', () => {
    expect(searchDeck(deck, 'auth supabase')[0].slide.title).toBe('Authentication')
    expect(searchDeck(deck, 'supabase auth')[0].slide.title).toBe('Authentication')
  })

  it('highlights every term in the snippet', () => {
    const [hit] = searchDeck(deck, 'backend complexity')
    expect(marks(hit.snippet)).toEqual(['backend', 'complexity'])
  })

  it('treats a quoted phrase as one literal string', () => {
    expect(searchDeck(deck, '"source of truth"')[0].slide.title).toBe('Database')
    expect(searchDeck(deck, '"truth of source"')).toEqual([])
  })

  it('prefers the slide where the terms sit in one passage', () => {
    const scattered = `# Doc

## Scattered

alpha ${'filler word '.repeat(40)} beta

## Together

alpha beta together.
`
    expect(searchDeck(buildDeck(scattered), 'alpha beta')[0].slide.title).toBe('Together')
  })
})

describe('fuzzy title matching', () => {
  it('finds a heading from an abbreviation', () => {
    const deck = buildDeck(doc)
    expect(searchDeck(deck, 'authn')[0].slide.title).toBe('Authentication')
  })

  it('tolerates a typo in a heading', () => {
    const deck = buildDeck('# Configuration\n\nbody text.\n\n## Other\n\nmore.\n')
    expect(searchDeck(deck, 'confguration')[0].slide.title).toBe('Configuration')
  })

  it('does not fuzzy-match the body, where a subsequence means nothing', () => {
    const deck = buildDeck('# Heading\n\nThe cat sat on a comfortable mat.\n')
    expect(searchDeck(deck, 'cmfrt')).toEqual([])
  })

  it('rejects a subsequence sprawled through the middle of words', () => {
    expect(fuzzyMatch('the quick brown fox jumps', 'ubm')).toBeNull()
  })

  it('matches the initials of a heading', () => {
    const deck = buildDeck('# Architecture Decision Records\n\nbody.\n')
    expect(searchDeck(deck, 'adr')[0].slide.title).toBe('Architecture Decision Records')
  })

  it('ranks an exact match above a fuzzy one', () => {
    const deck = buildDeck('# Authn\n\nbody.\n\n## Authentication\n\nbody.\n')
    const [first, second] = searchDeck(deck, 'authn')
    expect(first.slide.title).toBe('Authn')
    expect(second.slide.title).toBe('Authentication')
    expect(first.score).toBeGreaterThan(second.score)
  })

  it('never fuzzy-matches a quoted term', () => {
    expect(searchDeck(buildDeck(doc), '"authn"')).toEqual([])
  })

  it('prefers a match that starts words', () => {
    const spread = fuzzyMatch('alpha beta gamma', 'abg')
    expect(spread).not.toBeNull()
    expect(spread?.indices).toEqual([0, 6, 11])
  })
})

describe('search ranking', () => {
  it('keeps a late heading match even when earlier body matches fill the buffer', () => {
    const sections = Array.from(
      { length: 120 },
      (_, i) => `## Section ${i}\n\nthis body mentions widget here.\n`,
    ).join('\n')
    const deck = buildDeck(`# Doc\n\n${sections}\n## Widget reference\n\nlast one.\n`)
    const results = searchDeck(deck, 'widget', 10)
    expect(results[0].slide.title).toBe('Widget reference')
    expect(results[0].score).toBeGreaterThan(results[1].score)
  })

  it('still caps the number of results', () => {
    const sections = Array.from(
      { length: 80 },
      (_, i) => `## Section ${i}\n\nbody mentions widget.\n`,
    ).join('\n')
    expect(searchDeck(buildDeck(`# Doc\n\n${sections}`), 'widget', 10)).toHaveLength(10)
  })

  it('ranks a term that starts a word above one buried inside another', () => {
    const deck = buildDeck('# Reauthorised\n\nbody.\n\n## Auth tokens\n\nbody.\n')
    expect(searchDeck(deck, 'auth')[0].slide.title).toBe('Auth tokens')
  })

  it('keeps document order between equally good matches', () => {
    const deck = buildDeck('# Doc\n\n## Widget one\n\na.\n\n## Widget two\n\nb.\n')
    expect(searchDeck(deck, 'widget').map((hit) => hit.slide.index)).toEqual([1, 2])
  })
})

describe('search text quality', () => {
  it('separates table cells instead of welding them together', () => {
    const deck = buildDeck('# T\n\n| Key | Action |\n| --- | --- |\n| Left | Previous slide |\n')
    expect(deck.slides[0].text).toContain('Key | Action')
    expect(deck.slides[0].text).toContain('Left | Previous slide')
    expect(deck.slides[0].text).not.toContain('KeyAction')
  })

  it('keeps list items on separate lines', () => {
    const deck = buildDeck('# T\n\n- first item\n- second item\n')
    expect(deck.slides[0].text).not.toContain('first itemsecond item')
  })

  it('still indexes code and finds it', () => {
    const deck = buildDeck('# T\n\n```ts\nconst widget = 1\n```\n')
    expect(marks(searchDeck(deck, 'widget')[0].snippet)).toContain('widget')
  })

  it('elides a snippet taken from the middle of a long slide', () => {
    const body = `${'filler prose here. '.repeat(30)} needle ${'more prose. '.repeat(30)}`
    const deck = buildDeck(`# T\n\n${body}\n`)
    const snippet = plain(searchDeck(deck, 'needle')[0].snippet)
    expect(snippet.startsWith('…')).toBe(true)
    expect(snippet.endsWith('…')).toBe(true)
    expect(snippet).toContain('needle')
  })
})
