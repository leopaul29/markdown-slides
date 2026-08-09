import { languageFromClasses } from './html'

/**
 * Progressive enhancement applied to rendered segment HTML: scrollable tables,
 * code block chrome and safe external links. Idempotent: re-running it on an
 * already enhanced body changes nothing. Shared by every HTML view.
 */
export function enhanceSegmentBody(root: HTMLElement): void {
  for (const table of Array.from(root.querySelectorAll('table'))) {
    if (table.parentElement?.classList.contains('table-scroll')) continue
    const wrapper = document.createElement('div')
    wrapper.className = 'table-scroll'
    table.parentNode?.insertBefore(wrapper, table)
    wrapper.appendChild(table)
  }

  for (const pre of Array.from(root.querySelectorAll('pre'))) {
    if (pre.parentElement?.classList.contains('code-block')) continue
    const block = document.createElement('div')
    block.className = 'code-block'
    pre.parentNode?.insertBefore(block, pre)
    block.appendChild(pre)

    const code = pre.querySelector('code')
    const language = code ? languageFromClasses(code.classList) : null
    if (language) {
      const badge = document.createElement('span')
      badge.className = 'code-lang'
      badge.textContent = language
      block.appendChild(badge)
    }
  }

  for (const link of Array.from(root.querySelectorAll('a[href]'))) {
    const href = link.getAttribute('href') ?? ''
    if (/^(https?:)?\/\//i.test(href)) {
      link.setAttribute('target', '_blank')
      link.setAttribute('rel', 'noopener noreferrer')
    }
  }
}

/** Adds or removes the line-number gutter of every code block in `root`. */
export function applyLineNumbers(root: HTMLElement, enabled: boolean): void {
  for (const block of Array.from(root.querySelectorAll<HTMLElement>('.code-block'))) {
    const existing = block.querySelector('.code-gutter')
    if (!enabled) {
      existing?.remove()
      block.classList.remove('numbered')
      continue
    }
    block.classList.add('numbered')
    if (existing) continue

    const code = block.querySelector('code')
    if (!code) continue
    const lines = (code.textContent ?? '').replace(/\n$/, '').split('\n').length
    const gutter = document.createElement('span')
    gutter.className = 'code-gutter'
    gutter.setAttribute('aria-hidden', 'true')
    gutter.textContent = Array.from({ length: lines }, (_, i) => String(i + 1)).join('\n')
    block.appendChild(gutter)
  }
}
