import { describe, expect, it } from 'vitest'
import { compile } from '../compile'
import { STRATEGIES } from './index'

const doc = `# Guide

Opening prose for the guide.

## Install

Run the installer.

## Configure

Edit the file.

# Reference

The reference section.

## Options

Every option, listed.
`

describe('every strategy', () => {
  for (const strategy of STRATEGIES) {
    describe(strategy.name, () => {
      it('numbers segments consecutively and groups them into sections', () => {
        const model = compile(doc, { strategy: strategy.name, maxWeight: 6 })
        expect(model.strategy).toBe(strategy.name)
        expect(model.segments.map((segment) => segment.index)).toEqual(
          model.segments.map((_, i) => i),
        )
        for (const section of model.sections) {
          expect(section.segments.length).toBeGreaterThan(0)
          for (const [part, index] of section.segments.entries()) {
            const segment = model.segments[index]
            expect(segment.section).toBe(section.index)
            expect(segment.part).toBe(part + 1)
            expect(segment.partCount).toBe(section.segments.length)
          }
        }
      })

      it('keeps every block of the document, in order', () => {
        const model = compile(doc, { strategy: strategy.name, maxWeight: 6 })
        const text = model.segments.map((segment) => segment.text).join('\n')
        expect(text).toContain('Run the installer.')
        expect(text).toContain('Every option, listed.')
        expect(text.indexOf('Run the installer.')).toBeLessThan(text.indexOf('Edit the file.'))
      })

      it('is deterministic', () => {
        const a = compile(doc, { strategy: strategy.name })
        const b = compile(doc, { strategy: strategy.name })
        expect(JSON.stringify(a.toc)).toBe(JSON.stringify(b.toc))
        expect(a.segments.map((s) => s.text)).toEqual(b.segments.map((s) => s.text))
      })

      it('never splits a code block', () => {
        const code = '```js\n' + Array.from({ length: 60 }, (_, i) => `l${i}()`).join('\n') + '\n```'
        const model = compile(`# C\n\n${code}\n`, { strategy: strategy.name, maxWeight: 8 })
        const blocks = model.segments.flatMap((segment) =>
          segment.nodes.filter((node) => node.type === 'code'),
        )
        expect(blocks).toHaveLength(1)
      })
    })
  }
})

describe('headings', () => {
  it('opens a section at every # and ##', () => {
    const model = compile(doc, { strategy: 'headings' })
    expect(model.toc.map((entry) => entry.title)).toEqual([
      'Guide',
      'Install',
      'Configure',
      'Reference',
      'Options',
    ])
  })
})

describe('h1', () => {
  it('opens a section only at #, keeping ## inside it', () => {
    const model = compile(doc, { strategy: 'h1' })
    expect(model.toc.map((entry) => entry.title)).toEqual(['Guide', 'Reference'])
    expect(model.segments[0].text).toContain('Run the installer.')
  })
})

describe('fixed-length', () => {
  const long = `# Long\n\n${Array.from({ length: 24 }, (_, i) => `Paragraph number ${i}.`).join(
    '\n\n',
  )}\n`

  it('packs pages to about the same weight, wherever the headings are', () => {
    const model = compile(long, { strategy: 'fixed-length', maxWeight: 5 })
    expect(model.segments.length).toBeGreaterThan(3)
    // Every page but the last is full: adding its neighbour's first block
    // would have gone over the budget.
    for (const segment of model.segments.slice(0, -1)) {
      expect(segment.nodes.length).toBeGreaterThan(0)
      expect(segment.nodes.length).toBeLessThanOrEqual(5)
    }
  })

  it('ignores a heading that the headings strategy would break on', () => {
    const source = `# T\n\nOne short line.\n\n## Sub\n\nAnother short line.\n`
    const fixed = compile(source, { strategy: 'fixed-length', maxWeight: 40 })
    const headings = compile(source, { strategy: 'headings', maxWeight: 40 })
    expect(fixed.segments).toHaveLength(1)
    expect(headings.segments).toHaveLength(2)
  })

  it('names pages after the heading they fall under', () => {
    const model = compile(doc, { strategy: 'fixed-length', maxWeight: 4 })
    expect(model.toc[0].title).toBe('Guide')
    expect(model.toc.map((entry) => entry.title)).toContain('Options')
  })
})

describe('an unknown strategy', () => {
  it('falls back to the default rather than failing to open the document', () => {
    const model = compile(doc, { strategy: 'nonsense' as never })
    expect(model.strategy).toBe('headings')
  })
})
