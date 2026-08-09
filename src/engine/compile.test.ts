import { describe, expect, it } from 'vitest'
import { compile } from './compile'
import { normalize } from './markdown'

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
  it('creates one segment per # and ## heading', () => {
    const model = compile(doc)
    expect(model.segments.map((segment) => segment.title)).toEqual([
      'Authentication',
      'Why',
      'Alternatives',
      'Database',
    ])
  })

  it('keeps ### and deeper headings inside the current segment', () => {
    const model = compile('# A\n\n### Detail\n\ntext\n\n#### More\n\ntext\n')
    expect(model.segments).toHaveLength(1)
    expect(
      model.segments[0].nodes.filter((node) => node.type === 'heading').map((node) => node.depth),
    ).toEqual([3, 4])
  })

  it('records the enclosing group of a ## segment', () => {
    const model = compile(doc)
    expect(model.segments[1].group).toBe('Authentication')
    expect(model.segments[3].group).toBe('')
  })

  it('puts content that precedes any heading on its own segment', () => {
    const model = compile('Intro paragraph.\n\n# Real title\n\nBody.\n')
    expect(model.segments[0].level).toBe(0)
    expect(model.segments[0].text).toContain('Intro paragraph.')
    expect(model.segments[1].title).toBe('Real title')
  })

  it('never returns an empty document', () => {
    expect(compile('').segments).toHaveLength(1)
    expect(compile('   \n\n  ').segments).toHaveLength(1)
  })
})

describe('the model', () => {
  it('points every segment at the section that owns it', () => {
    const model = compile(doc)
    for (const segment of model.segments) {
      expect(model.sections[segment.section].segments).toContain(segment.index)
    }
  })

  it('covers every segment exactly once across its sections', () => {
    const model = compile(doc, { maxWeight: 4 })
    const owned = model.sections.flatMap((section) => section.segments)
    expect(owned).toEqual(model.segments.map((segment) => segment.index))
  })

  it('carries mdast nodes rather than markup', () => {
    const model = compile('# T\n\nSome **bold** text.\n')
    expect(model.segments[0].nodes[0].type).toBe('paragraph')
    expect(JSON.stringify(model.segments[0].nodes)).not.toContain('<')
  })
})

describe('table of contents', () => {
  it('lists every section in reading order, with its heading level', () => {
    const model = compile(doc)
    expect(model.toc.map((entry) => [entry.title, entry.level])).toEqual([
      ['Authentication', 1],
      ['Why', 2],
      ['Alternatives', 2],
      ['Database', 1],
    ])
  })

  it('points each entry at a real segment', () => {
    const model = compile(doc)
    for (const entry of model.toc) {
      expect(model.segments[entry.segmentIndex].title).toBe(entry.title)
      expect(model.sections[entry.sectionIndex].segments[0]).toBe(entry.segmentIndex)
    }
  })
})

describe('auto splitting', () => {
  const longSection = `# Long\n\n${'A paragraph of prose. '.repeat(12)}\n\n${'Another paragraph. '.repeat(12)}\n\n${'Yet more prose. '.repeat(12)}\n`

  it('splits tall sections into parts of the same section', () => {
    const model = compile(longSection, { maxWeight: 6 })
    expect(model.sections).toHaveLength(1)
    expect(model.sections[0].segments.length).toBeGreaterThan(1)
    expect(model.segments.every((segment) => segment.title === 'Long')).toBe(true)
    expect(model.segments.map((segment) => segment.part)).toEqual(
      model.segments.map((_, i) => i + 1),
    )
    expect(model.segments[0].partCount).toBe(model.segments.length)
  })

  it('never splits a code block, however long', () => {
    const code = '```js\n' + Array.from({ length: 80 }, (_, i) => `line${i}()`).join('\n') + '\n```'
    const model = compile(`# Code\n\n${code}\n`, { maxWeight: 10 })
    const withCode = model.segments.filter((segment) =>
      segment.nodes.some((node) => node.type === 'code'),
    )
    expect(withCode).toHaveLength(1)
    expect(withCode[0].nodes.filter((node) => node.type === 'code')).toHaveLength(1)
  })

  it('keeps a table on a single segment', () => {
    const rows = Array.from({ length: 30 }, (_, i) => `| r${i} | v${i} |`).join('\n')
    const model = compile(`# T\n\n| a | b |\n| - | - |\n${rows}\n`, { maxWeight: 8 })
    const withTable = model.segments.filter((segment) =>
      segment.nodes.some((node) => node.type === 'table'),
    )
    expect(withTable).toHaveLength(1)
  })

  it('does not leave a heading stranded at the end of a part', () => {
    const body = `${'Prose here. '.repeat(20)}\n\n### Next up\n\nMore text.\n`
    const model = compile(`# S\n\n${body}`, { maxWeight: 4 })
    for (const segment of model.segments.slice(0, -1)) {
      expect(segment.nodes[segment.nodes.length - 1]?.type).not.toBe('heading')
    }
  })

  it('does not strand a heading whose content is too heavy to share its part', () => {
    // The heading opens a part and the block after it is heavier than the whole
    // budget, so the heading is flushed alone — a part that *is* just a heading.
    const prose = 'Prose here. '.repeat(60)
    const code = '```js\n' + Array.from({ length: 40 }, (_, i) => `l${i}()`).join('\n') + '\n```'
    const model = compile(`# S\n\n${prose}\n\n### Next\n\n${code}\n`, { maxWeight: 10 })
    for (const segment of model.segments.slice(0, -1)) {
      expect(segment.nodes[segment.nodes.length - 1]?.type).not.toBe('heading')
    }
    // And the heading travels with its content rather than being dropped.
    const withCode = model.segments.find((segment) =>
      segment.nodes.some((node) => node.type === 'code'),
    )
    expect(withCode?.nodes[0].type).toBe('heading')
  })

  it('is deterministic', () => {
    const a = compile(doc)
    const b = compile(doc)
    expect(a.segments.map((s) => [s.index, s.part, s.section, s.title, s.text])).toEqual(
      b.segments.map((s) => [s.index, s.part, s.section, s.title, s.text]),
    )
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
