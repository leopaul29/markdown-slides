import { describe, expect, it } from 'vitest'
import { compile } from '../engine'
import { isSafeUrl, nodesToHtml, sanitizeUrls } from './html'

/*
 * The renderer is where an untrusted document could execute script, so these
 * are the tests that must never be relaxed. They render through `compile()`
 * because that is how the app reaches this code.
 */

describe('url safety', () => {
  const render = (markdown: string) => nodesToHtml(compile(markdown).segments[0].nodes)

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

  /*
   * hast keeps `srcset` as an array of "url descriptor" candidates rather than
   * a string, so this branch is the one a `typeof value === 'string'` guard
   * would silently skip. Driven directly because Markdown cannot express a
   * srcset — which is also why it needs a test of its own.
   */
  it('filters unsafe candidates out of a srcset and keeps the safe ones', () => {
    const img = {
      type: 'element',
      tagName: 'img',
      properties: {
        srcSet: ['javascript:alert(1) 2x', 'https://example.com/i.png 1x'],
      },
    }
    sanitizeUrls(img)
    expect(img.properties.srcSet).toEqual(['https://example.com/i.png 1x'])
  })

  it('drops a srcset whose every candidate is unsafe', () => {
    const img = {
      type: 'element',
      tagName: 'img',
      properties: {
        src: 'https://example.com/i.png',
        srcSet: ['javascript:alert(1) 2x', 'data:text/html,<script> 1x'],
      },
    }
    sanitizeUrls(img)
    expect('srcSet' in img.properties).toBe(false)
    expect(img.properties.src).toBe('https://example.com/i.png')
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
