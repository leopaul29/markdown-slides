import { describe, expect, it } from 'vitest'
import { compile } from '../engine'
import { fuzzyMatch, parseQuery, searchDocument, type SearchResult } from './search'

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
    const model = compile(doc)
    const [hit] = searchDocument(model, 'firebase')
    expect(hit.segment.title).toBe('Alternatives')
    expect(marks(hit.snippet)).toEqual(['Firebase'])
  })

  it('ranks heading matches first', () => {
    const model = compile(doc)
    expect(searchDocument(model, 'database')[0].segment.title).toBe('Database')
  })

  it('highlights the match inside the title too', () => {
    const [hit] = searchDocument(compile(doc), 'data')
    expect(marks(hit.title)).toEqual(['Data'])
    expect(plain(hit.title)).toBe('Database')
  })

  it('returns nothing for an empty query', () => {
    expect(searchDocument(compile(doc), '   ')).toEqual([])
  })

  it('is deterministic', () => {
    const model = compile(doc)
    const first = searchDocument(model, 'auth')
    const second = searchDocument(model, 'auth')
    expect(first.map((hit) => [hit.segment.index, hit.score])).toEqual(
      second.map((hit) => [hit.segment.index, hit.score]),
    )
  })
})

describe('multi-term queries', () => {
  const model = compile(doc)

  it('requires every term to match', () => {
    expect(searchDocument(model, 'supabase auth').map((hit) => hit.segment.title)).toEqual([
      'Authentication',
    ])
    expect(searchDocument(model, 'supabase postgresql')).toEqual([])
  })

  it('matches terms in any order', () => {
    expect(searchDocument(model, 'auth supabase')[0].segment.title).toBe('Authentication')
    expect(searchDocument(model, 'supabase auth')[0].segment.title).toBe('Authentication')
  })

  it('highlights every term in the snippet', () => {
    const [hit] = searchDocument(model, 'backend complexity')
    expect(marks(hit.snippet)).toEqual(['backend', 'complexity'])
  })

  it('treats a quoted phrase as one literal string', () => {
    expect(searchDocument(model, '"source of truth"')[0].segment.title).toBe('Database')
    expect(searchDocument(model, '"truth of source"')).toEqual([])
  })

  it('prefers the segment where the terms sit in one passage', () => {
    const scattered = `# Doc

## Scattered

alpha ${'filler word '.repeat(40)} beta

## Together

alpha beta together.
`
    expect(searchDocument(compile(scattered), 'alpha beta')[0].segment.title).toBe('Together')
  })
})

describe('fuzzy title matching', () => {
  it('finds a heading from an abbreviation', () => {
    const model = compile(doc)
    expect(searchDocument(model, 'authn')[0].segment.title).toBe('Authentication')
  })

  it('tolerates a typo in a heading', () => {
    const model = compile('# Configuration\n\nbody text.\n\n## Other\n\nmore.\n')
    expect(searchDocument(model, 'confguration')[0].segment.title).toBe('Configuration')
  })

  it('does not fuzzy-match the body, where a subsequence means nothing', () => {
    const model = compile('# Heading\n\nThe cat sat on a comfortable mat.\n')
    expect(searchDocument(model, 'cmfrt')).toEqual([])
  })

  it('rejects a subsequence sprawled through the middle of words', () => {
    expect(fuzzyMatch('the quick brown fox jumps', 'ubm')).toBeNull()
  })

  it('matches the initials of a heading', () => {
    const model = compile('# Architecture Decision Records\n\nbody.\n')
    expect(searchDocument(model, 'adr')[0].segment.title).toBe('Architecture Decision Records')
  })

  it('ranks an exact match above a fuzzy one', () => {
    const model = compile('# Authn\n\nbody.\n\n## Authentication\n\nbody.\n')
    const [first, second] = searchDocument(model, 'authn')
    expect(first.segment.title).toBe('Authn')
    expect(second.segment.title).toBe('Authentication')
    expect(first.score).toBeGreaterThan(second.score)
  })

  it('never fuzzy-matches a quoted term', () => {
    expect(searchDocument(compile(doc), '"authn"')).toEqual([])
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
    const model = compile(`# Doc\n\n${sections}\n## Widget reference\n\nlast one.\n`)
    const results = searchDocument(model, 'widget', 10)
    expect(results[0].segment.title).toBe('Widget reference')
    expect(results[0].score).toBeGreaterThan(results[1].score)
  })

  it('still caps the number of results', () => {
    const sections = Array.from(
      { length: 80 },
      (_, i) => `## Section ${i}\n\nbody mentions widget.\n`,
    ).join('\n')
    expect(searchDocument(compile(`# Doc\n\n${sections}`), 'widget', 10)).toHaveLength(10)
  })

  it('ranks a term that starts a word above one buried inside another', () => {
    const model = compile('# Reauthorised\n\nbody.\n\n## Auth tokens\n\nbody.\n')
    expect(searchDocument(model, 'auth')[0].segment.title).toBe('Auth tokens')
  })

  it('keeps document order between equally good matches', () => {
    const model = compile('# Doc\n\n## Widget one\n\na.\n\n## Widget two\n\nb.\n')
    expect(searchDocument(model, 'widget').map((hit) => hit.segment.index)).toEqual([1, 2])
  })
})

describe('search text quality', () => {
  it('separates table cells instead of welding them together', () => {
    const model = compile('# T\n\n| Key | Action |\n| --- | --- |\n| Left | Previous slide |\n')
    expect(model.segments[0].text).toContain('Key | Action')
    expect(model.segments[0].text).toContain('Left | Previous slide')
    expect(model.segments[0].text).not.toContain('KeyAction')
  })

  it('keeps list items on separate lines', () => {
    const model = compile('# T\n\n- first item\n- second item\n')
    expect(model.segments[0].text).not.toContain('first itemsecond item')
  })

  it('still indexes code and finds it', () => {
    const model = compile('# T\n\n```ts\nconst widget = 1\n```\n')
    expect(marks(searchDocument(model, 'widget')[0].snippet)).toContain('widget')
  })

  it('elides a snippet taken from the middle of a long segment', () => {
    const body = `${'filler prose here. '.repeat(30)} needle ${'more prose. '.repeat(30)}`
    const model = compile(`# T\n\n${body}\n`)
    const snippet = plain(searchDocument(model, 'needle')[0].snippet)
    expect(snippet.startsWith('…')).toBe(true)
    expect(snippet.endsWith('…')).toBe(true)
    expect(snippet).toContain('needle')
  })
})
