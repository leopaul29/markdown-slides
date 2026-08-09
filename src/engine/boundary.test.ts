import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { compile } from './compile'

/*
 * The engine/renderer boundary, as a test rather than as a paragraph in a
 * document. It is the rule the whole v2 split exists to protect: the engine
 * produces a model of mdast nodes, and knows nothing about how anything is
 * drawn. Prose does not hold that line — this does.
 */

const engineDir = fileURLToPath(new URL('.', import.meta.url))
/** This file holds deliberate examples of crossings, so it cannot scan itself. */
const selfPath = fileURLToPath(import.meta.url)

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return path.endsWith('.ts') && path !== selfPath ? [path] : []
  })
}

/*
 * Every way a module can reach another one. A static import was not enough:
 * `export { x } from '…'` and `await import('…')` name a module just as much,
 * and a boundary test that only looks at one of the three is a boundary that
 * can be crossed by writing the import differently.
 */
const REFERENCES = [
  /^\s*(?:import|export)\s[^'"]*['"]([^'"]+)['"]/gm,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
]

function referencesOf(path: string): string[] {
  const source = readFileSync(path, 'utf8')
  return REFERENCES.flatMap((pattern) =>
    Array.from(source.matchAll(pattern), (match) => match[1]),
  )
}

describe('the engine never depends on the render layer', () => {
  const files = sourceFiles(engineDir)

  it('finds the engine sources', () => {
    expect(files.length).toBeGreaterThan(5)
  })

  for (const file of files) {
    const name = file.slice(engineDir.length)
    it(`${name} imports nothing from a view or a renderer`, () => {
      for (const specifier of referencesOf(file)) {
        // Matched anywhere in the specifier rather than at `../`, so neither a
        // deeper relative path nor a future path alias can slip past it.
        expect(specifier).not.toMatch(/(^|\/)(render|components)(\/|$)/)
        expect(specifier).not.toMatch(/^react/)
        expect(specifier).not.toMatch(/reveal/)
        expect(specifier).not.toMatch(/rehype|hast|lowlight|highlight\.js/)
      }
    })
  }
})

describe('the boundary check itself', () => {
  /*
   * A test that enforces a rule is only worth as much as its matcher, and this
   * one is the whole mechanism behind "the engine knows nothing about the
   * renderer". These cases are the ways it has to be able to fail.
   */
  const crossings = [
    "import { nodesToHtml } from '../render/html'",
    "import { nodesToHtml } from '../../render/html'",
    "import { Deck } from '@/components/Deck'",
    "export { nodesToHtml } from '../render/html'",
    "export * from '../../render/html'",
    "const html = await import('../render/html')",
  ]

  for (const line of crossings) {
    it(`sees through: ${line}`, () => {
      const specifiers = REFERENCES.flatMap((pattern) =>
        Array.from(line.matchAll(pattern), (match) => match[1]),
      )
      expect(specifiers).not.toEqual([])
      expect(specifiers.some((s) => /(^|\/)(render|components)(\/|$)/.test(s))).toBe(true)
    })
  }

  it('leaves the engine’s own imports alone', () => {
    for (const specifier of ['mdast', './markdown', '../nodes', 'remark-parse', 'node:fs']) {
      expect(specifier).not.toMatch(/(^|\/)(render|components)(\/|$)/)
    }
  })
})

describe('the model never contains markup', () => {
  it('keeps HTML out of the compiled document', () => {
    const model = compile(
      '# T\n\n```js\nconst a = 1\n```\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\n[link](https://example.com)\n',
    )
    const serialized = JSON.stringify(model)
    expect(serialized).not.toContain('<pre')
    expect(serialized).not.toContain('<table')
    expect(serialized).not.toContain('hljs')
  })
})
