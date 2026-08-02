export type DocSource = 'file' | 'url' | 'sample' | 'paste'

export interface MarkdownDoc {
  name: string
  text: string
  source: DocSource
  url?: string
}

const DOC_KEY = 'markdown-slides:doc'
const SETTING_PREFIX = 'markdown-slides:'
/** Documents beyond this size are still shown, just not cached across reloads. */
const MAX_PERSISTED_CHARS = 4_000_000

export function readStoredDoc(): MarkdownDoc | null {
  try {
    const raw = localStorage.getItem(DOC_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as MarkdownDoc
    return typeof parsed?.text === 'string' ? parsed : null
  } catch {
    return null
  }
}

export function storeDoc(doc: MarkdownDoc | null): void {
  try {
    if (!doc) {
      localStorage.removeItem(DOC_KEY)
      return
    }
    if (doc.text.length > MAX_PERSISTED_CHARS) {
      localStorage.removeItem(DOC_KEY)
      return
    }
    localStorage.setItem(DOC_KEY, JSON.stringify(doc))
  } catch {
    /* Private mode or quota exceeded: the document still works this session. */
  }
}

export function readSetting(key: string, fallback: string): string {
  try {
    return localStorage.getItem(SETTING_PREFIX + key) ?? fallback
  } catch {
    return fallback
  }
}

export function writeSetting(key: string, value: string): void {
  try {
    localStorage.setItem(SETTING_PREFIX + key, value)
  } catch {
    /* ignore */
  }
}

export function isMarkdownFile(file: File): boolean {
  return /\.(md|markdown|mdown|mkd|mdx|txt)$/i.test(file.name) || file.type === 'text/markdown'
}

export async function readMarkdownFile(file: File): Promise<MarkdownDoc> {
  const text = await file.text()
  return { name: file.name, text, source: 'file' }
}

export async function fetchMarkdown(rawUrl: string): Promise<MarkdownDoc> {
  const url = toRawUrl(rawUrl.trim())
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Could not load that URL (HTTP ${response.status}).`)
  }
  const text = await response.text()
  return { name: fileNameFromUrl(url), text, source: 'url', url }
}

/** Convenience: a GitHub blob link points at HTML, so use the raw file instead. */
function toRawUrl(url: string): string {
  const blob = url.match(
    /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/,
  )
  if (blob) {
    return `https://raw.githubusercontent.com/${blob[1]}/${blob[2]}/${blob[3]}`
  }
  return url
}

function fileNameFromUrl(url: string): string {
  try {
    const path = new URL(url, location.href).pathname
    return decodeURIComponent(path.split('/').filter(Boolean).pop() ?? 'document.md')
  } catch {
    return 'document.md'
  }
}
