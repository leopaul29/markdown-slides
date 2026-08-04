import { describe, expect, it } from 'vitest'
import { buildDeck } from './slides'
import { isSafeUrl, nodesToHtml, normalize } from './markdown'
import { searchDeck } from './search'

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

describe('heading rules', () => {
  it('creates one slide per # and ## heading', () => {
    const deck = buildDeck(doc)
    expect(deck.slides.map((slide) => slide.title)).toEqual([
      'Authentication',
      'Why',
      'Alternatives',
      'Database',
    ])
  })

  it('keeps ### and deeper headings inside the current slide', () => {
    const deck = buildDeck('# A\n\n### Detail\n\ntext\n\n#### More\n\ntext\n')
    expect(deck.slides).toHaveLength(1)
    expect(deck.slides[0].headings.map((heading) => heading.text)).toEqual(['Detail', 'More'])
  })

  it('records the enclosing group of a ## slide', () => {
    const deck = buildDeck(doc)
    expect(deck.slides[1].group).toBe('Authentication')
    expect(deck.slides[3].group).toBe('')
  })

  it('puts content that precedes any heading on its own slide', () => {
    const deck = buildDeck('Intro paragraph.\n\n# Real title\n\nBody.\n')
    expect(deck.slides[0].level).toBe(0)
    expect(deck.slides[0].text).toContain('Intro paragraph.')
    expect(deck.slides[1].title).toBe('Real title')
  })

  it('never returns an empty deck', () => {
    expect(buildDeck('').slides).toHaveLength(1)
    expect(buildDeck('   \n\n  ').slides).toHaveLength(1)
  })
})

describe('table of contents', () => {
  it('nests ## sections under their # group', () => {
    const deck = buildDeck(doc)
    expect(deck.toc.map((entry) => entry.title)).toEqual(['Authentication', 'Database'])
    expect(deck.toc[0].children.map((entry) => entry.title)).toEqual(['Why', 'Alternatives'])
  })

  it('points each entry at a real slide', () => {
    const deck = buildDeck(doc)
    for (const entry of deck.toc.flatMap((e) => [e, ...e.children])) {
      expect(deck.slides[entry.slideIndex].title).toBe(entry.title)
    }
  })
})

describe('auto splitting', () => {
  const longSection = `# Long\n\n${'A paragraph of prose. '.repeat(12)}\n\n${'Another paragraph. '.repeat(12)}\n\n${'Yet more prose. '.repeat(12)}\n`

  it('splits tall sections into vertical parts of the same section', () => {
    const deck = buildDeck(longSection, { maxWeight: 6 })
    expect(deck.columns).toHaveLength(1)
    expect(deck.columns[0].length).toBeGreaterThan(1)
    expect(deck.slides.every((slide) => slide.title === 'Long')).toBe(true)
    expect(deck.slides.map((slide) => slide.v)).toEqual(deck.slides.map((_, i) => i))
    expect(deck.slides[0].partCount).toBe(deck.slides.length)
  })

  it('never splits a code block, however long', () => {
    const code = '```js\n' + Array.from({ length: 80 }, (_, i) => `line${i}()`).join('\n') + '\n```'
    const deck = buildDeck(`# Code\n\n${code}\n`, { maxWeight: 10 })
    const codeSlides = deck.slides.filter((slide) =>
      slide.nodes.some((node) => node.type === 'code'),
    )
    expect(codeSlides).toHaveLength(1)
    expect(codeSlides[0].nodes.filter((node) => node.type === 'code')).toHaveLength(1)
  })

  it('keeps a table on a single slide', () => {
    const rows = Array.from({ length: 30 }, (_, i) => `| r${i} | v${i} |`).join('\n')
    const deck = buildDeck(`# T\n\n| a | b |\n| - | - |\n${rows}\n`, { maxWeight: 8 })
    const tableSlides = deck.slides.filter((slide) =>
      slide.nodes.some((node) => node.type === 'table'),
    )
    expect(tableSlides).toHaveLength(1)
  })

  it('does not leave a heading stranded at the end of a part', () => {
    const body = `${'Prose here. '.repeat(20)}\n\n### Next up\n\nMore text.\n`
    const deck = buildDeck(`# S\n\n${body}`, { maxWeight: 4 })
    for (const slide of deck.slides.slice(0, -1)) {
      expect(slide.nodes[slide.nodes.length - 1]?.type).not.toBe('heading')
    }
  })

  it('is deterministic', () => {
    const a = buildDeck(doc)
    const b = buildDeck(doc)
    expect(a.slides.map((s) => [s.h, s.v, s.title, s.text])).toEqual(
      b.slides.map((s) => [s.h, s.v, s.title, s.text]),
    )
  })
})

describe('search', () => {
  it('finds body text and reports the surrounding snippet', () => {
    const deck = buildDeck(doc)
    const [hit] = searchDeck(deck, 'firebase')
    expect(hit.slide.title).toBe('Alternatives')
    expect(hit.match).toBe('Firebase')
  })

  it('ranks heading matches first', () => {
    const deck = buildDeck(doc)
    expect(searchDeck(deck, 'database')[0].slide.title).toBe('Database')
  })

  it('returns nothing for an empty query', () => {
    expect(searchDeck(buildDeck(doc), '   ')).toEqual([])
  })
})

describe('normalize', () => {
  it('repairs documents whose Markdown punctuation was escaped', () => {
    const escaped = '\\# Title\n\n\\## Section\n\n\\* item\n\n\\## Another\n'
    expect(normalize(escaped)).toBe('# Title\n\n## Section\n\n* item\n\n## Another\n')
  })

  it('leaves ordinary documents untouched', () => {
    const source = '# Title\n\nA literal \\* star and a \\# hash.\n'
    expect(normalize(source)).toBe(source)
  })
})

describe('url safety', () => {
  const render = (markdown: string) => nodesToHtml(buildDeck(markdown).slides[0].nodes)

  it('drops script-bearing link schemes', () => {
    const html = render('# T\n\n[click](javascript:alert(1))\n')
    expect(html).not.toContain('javascript:')
    expect(html).toContain('click')
  })

  it('never emits an href that is not on the allow-list', () => {
    const html = render('# T\n\n[a](javascript:x) [b](vbscript:y) [c](file:///etc/passwd)\n')
    expect(html).not.toMatch(/href="(?!https?:|mailto:|tel:|[.#/])/i)
  })


  it('drops data: documents used as links', () => {
    const html = render('# T\n\n[x](data:text/html;base64,PHNjcmlwdD4=)\n')
    expect(html).not.toContain('data:text/html')
  })

  it('drops unsafe image sources', () => {
    const html = render('# T\n\n![i](javascript:alert(1))\n')
    expect(html).not.toContain('javascript:')
  })

  it('keeps ordinary links and images', () => {
    const html = render(
      '# T\n\n[a](https://example.com) [b](./rel.md) [c](#frag) [d](mailto:a@b.c)\n\n![i](https://example.com/i.png)\n',
    )
    expect(html).toContain('https://example.com')
    expect(html).toContain('./rel.md')
    expect(html).toContain('#frag')
    expect(html).toContain('mailto:a@b.c')
    expect(html).toContain('https://example.com/i.png')
  })

  it('keeps inline image data URIs', () => {
    const html = render('# T\n\n![i](data:image/png;base64,iVBORw0KGgo=)\n')
    expect(html).toContain('data:image/png')
  })

  it('classifies schemes directly', () => {
    expect(isSafeUrl('https://example.com', true)).toBe(true)
    expect(isSafeUrl('HTTPS://EXAMPLE.COM', true)).toBe(true)
    expect(isSafeUrl('JavaScript:alert(1)', true)).toBe(false)
    expect(isSafeUrl('vbscript:msgbox', true)).toBe(false)
    expect(isSafeUrl('file:///etc/passwd', true)).toBe(false)
    expect(isSafeUrl('/absolute/path.md', true)).toBe(true)
    // Browsers strip control characters before resolving a URL, so we do too.
    expect(isSafeUrl('java\tscript:alert(1)', true)).toBe(false)
    expect(isSafeUrl('  javascript:alert(1)', true)).toBe(false)
    expect(isSafeUrl('data:image/png;base64,AAAA', false)).toBe(true)
    expect(isSafeUrl('data:text/html,<script>', false)).toBe(false)
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
    expect(results[0].titleMatch).toBe(true)
  })

  it('still caps the number of results', () => {
    const sections = Array.from(
      { length: 80 },
      (_, i) => `## Section ${i}\n\nbody mentions widget.\n`,
    ).join('\n')
    expect(searchDeck(buildDeck(`# Doc\n\n${sections}`), 'widget', 10)).toHaveLength(10)
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
    expect(searchDeck(deck, 'widget')[0].match).toBe('widget')
  })
})
