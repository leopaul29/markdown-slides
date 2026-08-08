export type DocSource = 'file' | 'url' | 'sample' | 'paste'

export interface MarkdownDoc {
  name: string
  text: string
  source: DocSource
  url?: string
}

const DOC_KEY = 'markdown-reader:doc'
const SETTING_PREFIX = 'markdown-reader:'
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

/** True when the browser can hand back a re-readable handle (Chromium today). */
export function canWatchFiles(): boolean {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window
}

interface DropItem extends DataTransferItem {
  getAsFileSystemHandle?: () => Promise<FileSystemHandle | null>
}

/**
 * A dropped file is watchable too, but only if the handle is claimed while the
 * drop event is still live: the browser neuters the `DataTransfer` as soon as
 * the handler returns, so `getAsFileSystemHandle()` has to be *called*
 * synchronously even though its result is awaited later. Hence a promise out
 * rather than an async function. Null where the API is missing (non-Chromium),
 * which simply means the drop loads without watching, as before.
 */
export function handleFromDrop(event: DragEvent): Promise<FileSystemFileHandle | null> | null {
  const item = event.dataTransfer?.items?.[0] as DropItem | undefined
  if (typeof item?.getAsFileSystemHandle !== 'function') return null
  return item
    .getAsFileSystemHandle()
    .then((handle) =>
      handle && handle.kind === 'file' ? (handle as FileSystemFileHandle) : null,
    )
    .catch(() => null)
}

interface PickedFile {
  doc: MarkdownDoc
  handle: FileSystemFileHandle
  lastModified: number
}

/**
 * Opens a file through the File System Access API, which — unlike an `<input>`
 * — yields a handle the app can re-read later to pick up edits.
 */
export async function pickMarkdownFile(): Promise<PickedFile | null> {
  const picker = (window as unknown as {
    showOpenFilePicker: (options: unknown) => Promise<FileSystemFileHandle[]>
  }).showOpenFilePicker
  let handles: FileSystemFileHandle[]
  try {
    handles = await picker({
      types: [
        {
          description: 'Markdown',
          accept: { 'text/markdown': ['.md', '.markdown', '.mdown', '.mkd', '.mdx', '.txt'] },
        },
      ],
      multiple: false,
    })
  } catch {
    return null // the user dismissed the picker
  }
  const handle = handles[0]
  if (!handle) return null
  const file = await handle.getFile()
  return { doc: await readMarkdownFile(file), handle, lastModified: file.lastModified }
}

/** Re-reads a watched file, returning null when it has not changed. */
export async function readIfChanged(
  handle: FileSystemFileHandle,
  since: number,
): Promise<{ doc: MarkdownDoc; lastModified: number } | null> {
  const file = await handle.getFile()
  if (file.lastModified <= since) return null
  return { doc: await readMarkdownFile(file), lastModified: file.lastModified }
}

export async function readMarkdownFile(file: File): Promise<MarkdownDoc> {
  const text = await file.text()
  return { name: file.name, text, source: 'file' }
}

/** A server that accepts the connection and never answers must not hang the UI. */
const FETCH_TIMEOUT_MS = 20_000

export async function fetchMarkdown(rawUrl: string, signal?: AbortSignal): Promise<MarkdownDoc> {
  const url = toRawUrl(rawUrl.trim())
  const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS)
  const abort = signal ? AbortSignal.any([signal, timeout]) : timeout

  let response: Response
  try {
    response = await fetch(url, { signal: abort })
  } catch (cause) {
    if (timeout.aborted) throw new Error('That URL took too long to respond.')
    throw cause
  }

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
