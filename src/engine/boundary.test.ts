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

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return path.endsWith('.ts') ? [path] : []
  })
}

const IMPORT = /^\s*import\s[^'"]*['"]([^'"]+)['"]/gm

function importsOf(path: string): string[] {
  const source = readFileSync(path, 'utf8')
  return Array.from(source.matchAll(IMPORT), (match) => match[1])
}

describe('the engine never depends on the render layer', () => {
  const files = sourceFiles(engineDir)

  it('finds the engine sources', () => {
    expect(files.length).toBeGreaterThan(5)
  })

  for (const file of files) {
    const name = file.slice(engineDir.length)
    it(`${name} imports nothing from a view or a renderer`, () => {
      for (const specifier of importsOf(file)) {
        expect(specifier).not.toMatch(/\.\.\/(render|components)/)
        expect(specifier).not.toMatch(/^react/)
        expect(specifier).not.toMatch(/reveal/)
        expect(specifier).not.toMatch(/rehype|hast|lowlight|highlight\.js/)
      }
    })
  }
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
