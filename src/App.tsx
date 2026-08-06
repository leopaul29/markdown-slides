import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Deck, type DeckHandle } from './components/Deck'
import { Sidebar } from './components/Sidebar'
import { SearchPalette } from './components/SearchPalette'
import { Welcome } from './components/Welcome'
import { Lightbox } from './components/Lightbox'
import {
  CloseIcon,
  FileIcon,
  GridIcon,
  HashIcon,
  MenuIcon,
  MoonIcon,
  RefreshIcon,
  SearchIcon,
  SunIcon,
  WatchIcon,
} from './components/icons'
import { buildDeck } from './lib/slides'
import {
  canWatchFiles,
  fetchMarkdown,
  isMarkdownFile,
  pickMarkdownFile,
  readIfChanged,
  readMarkdownFile,
  readSetting,
  readStoredDoc,
  storeDoc,
  writeSetting,
  type MarkdownDoc,
} from './lib/document'
import sampleMarkdown from './examples/tour.md?raw'

type Theme = 'light' | 'dark'

/** Reads a `#/12` fragment as a 1-based slide number. */
function readHashIndex(): number | null {
  const match = /^#\/(\d+)$/.exec(location.hash)
  return match ? Number(match[1]) : null
}

export default function App() {
  const [doc, setDoc] = useState<MarkdownDoc | null>(() => readStoredDoc())
  const [theme, setTheme] = useState<Theme>(
    () => (document.documentElement.dataset.theme as Theme) ?? 'dark',
  )
  const [sidebarOpen, setSidebarOpen] = useState(() => readSetting('sidebar', 'open') === 'open')
  const [lineNumbers, setLineNumbers] = useState(() => readSetting('lineNumbers', 'off') === 'on')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [searchOpen, setSearchOpen] = useState(false)
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [watch, setWatch] = useState<{ handle: FileSystemFileHandle; lastModified: number } | null>(
    null,
  )
  const [watching, setWatching] = useState(true)

  const deckRef = useRef<DeckHandle>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  /** Slide requested by the URL fragment, consumed once the deck is built. */
  const pendingHash = useRef<number | null>(readHashIndex())

  const deck = useMemo(() => (doc ? buildDeck(doc.text) : null), [doc])
  const currentSlide = deck?.slides[currentIndex]

  const applyDoc = useCallback((next: MarkdownDoc, keepPosition = false) => {
    setDoc(next)
    storeDoc(next)
    setError(null)
    setSearchOpen(false)
    if (keepPosition) {
      // A live reload should land the reader back where they were reading.
      pendingHash.current = currentIndexRef.current + 1
    } else {
      setCurrentIndex(0)
    }
  }, [])

  const currentIndexRef = useRef(0)
  useEffect(() => {
    currentIndexRef.current = currentIndex
  }, [currentIndex])

  /*
   * A `?src=` fetch starts while the user can already drop a file, so loads can
   * overlap. Only the most recently started one is allowed to win.
   */
  const loadToken = useRef(0)

  /** Invalidates any in-flight load, for actions that replace the document now. */
  const cancelPendingLoad = useCallback(() => {
    loadToken.current += 1
    setBusy(false)
  }, [])

  const openWithPicker = useCallback(async () => {
    const picked = await pickMarkdownFile()
    if (!picked) return
    loadToken.current += 1
    setWatch({ handle: picked.handle, lastModified: picked.lastModified })
    applyDoc(picked.doc)
  }, [applyDoc])

  const openFile = useCallback(
    async (file: File) => {
      if (!isMarkdownFile(file)) {
        setError(`“${file.name}” does not look like a Markdown file.`)
        return
      }
      const token = ++loadToken.current
      try {
        setBusy(true)
        const loaded = await readMarkdownFile(file)
        if (token !== loadToken.current) return
        setWatch(null)
        applyDoc(loaded)
      } catch {
        if (token === loadToken.current) setError(`Could not read “${file.name}”.`)
      } finally {
        if (token === loadToken.current) setBusy(false)
      }
    },
    [applyDoc],
  )

  const openUrl = useCallback(
    async (url: string) => {
      const token = ++loadToken.current
      try {
        setBusy(true)
        setError(null)
        const loaded = await fetchMarkdown(url)
        if (token !== loadToken.current) return
        setWatch(null)
        applyDoc(loaded)
      } catch (cause) {
        if (token !== loadToken.current) return
        setError(
          cause instanceof Error
            ? `${cause.message} The server may also be blocking cross-origin requests.`
            : 'Could not load that URL.',
        )
      } finally {
        if (token === loadToken.current) setBusy(false)
      }
    },
    [applyDoc],
  )

  const goTo = useCallback((index: number) => {
    deckRef.current?.goTo(index)
  }, [])

  // `?src=…` lets you deep-link the reader at any Markdown file on the web.
  useEffect(() => {
    const src = new URLSearchParams(location.search).get('src')
    if (src) void openUrl(src)
  }, [openUrl])

  // A `#/12` fragment opens the document at that slide, so a position can be
  // bookmarked or shared. Consumed once per deck, before any hash is written.
  useEffect(() => {
    if (!deck) return
    const target = pendingHash.current
    pendingHash.current = null
    if (target !== null && target >= 1 && target <= deck.slides.length) {
      goTo(target - 1)
    }
  }, [deck, goTo])

  useEffect(() => {
    if (!deck || pendingHash.current !== null) return
    // `replaceState` keeps the back button useful for leaving the app.
    history.replaceState(null, '', `#/${currentIndex + 1}`)
  }, [deck, currentIndex])

  /*
   * Live reload: the File System Access API hands back a handle that can be
   * re-read, so an edit in another window shows up without re-dropping the file.
   * `lastModified` is polled because the platform has no change event.
   */
  useEffect(() => {
    if (!watch || !watching) return
    let stopped = false
    const timer = setInterval(async () => {
      try {
        const changed = await readIfChanged(watch.handle, watch.lastModified)
        if (stopped || !changed) return
        setWatch({ handle: watch.handle, lastModified: changed.lastModified })
        applyDoc(changed.doc, true)
      } catch {
        // Permission revoked or the file went away; stop watching quietly.
        if (!stopped) setWatch(null)
      }
    }, 1000)
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [watch, watching, applyDoc])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    writeSetting('theme', theme)
  }, [theme])

  useEffect(() => {
    writeSetting('sidebar', sidebarOpen ? 'open' : 'closed')
  }, [sidebarOpen])

  useEffect(() => {
    writeSetting('lineNumbers', lineNumbers ? 'on' : 'off')
  }, [lineNumbers])

  // App-level shortcuts. Captured before Reveal's own keyboard handler runs.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing =
        target?.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        event.stopPropagation()
        if (deck) setSearchOpen(true)
        return
      }
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return

      if (event.key === '/') {
        event.preventDefault()
        event.stopPropagation()
        if (deck) setSearchOpen(true)
      } else if (event.key === 'm' || event.key === 'M') {
        event.stopPropagation()
        setSidebarOpen((open) => !open)
      } else if (event.key === 't' || event.key === 'T') {
        event.stopPropagation()
        setTheme((value) => (value === 'dark' ? 'light' : 'dark'))
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [deck])

  // Dropping a file anywhere in the window replaces the current document.
  useEffect(() => {
    const onDragOver = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('Files')) return
      event.preventDefault()
      setDragging(true)
    }
    const onDragLeave = (event: DragEvent) => {
      if (event.relatedTarget === null) setDragging(false)
    }
    const onDrop = (event: DragEvent) => {
      event.preventDefault()
      setDragging(false)
      const file = event.dataTransfer?.files?.[0]
      if (file) void openFile(file)
    }
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [openFile])

  const onImageClick = useCallback((src: string, alt: string) => {
    setLightbox({ src, alt })
  }, [])

  return (
    <div className="app">
      <header className="topbar">
        <button
          type="button"
          className="icon-button"
          onClick={() => setSidebarOpen((open) => !open)}
          aria-pressed={sidebarOpen}
          aria-label="Table of contents"
          title="Table of contents (M)"
          disabled={!deck}
        >
          <MenuIcon />
        </button>

        <div style={{ minWidth: 0, display: 'flex', alignItems: 'baseline', gap: '0.55rem' }}>
          <strong
            style={{
              fontSize: '0.9rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {doc?.name ?? 'Markdown Reader'}
          </strong>
          {deck && currentSlide ? (
            <span className="muted" style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
              {currentSlide.index + 1} / {deck.slides.length}
            </span>
          ) : null}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
          {deck ? (
            <>
              <button
                type="button"
                className="icon-button"
                onClick={() => setSearchOpen(true)}
                aria-label="Search document"
                title="Search (Ctrl/⌘ K)"
              >
                <SearchIcon />
                <span className="kbd" style={{ marginLeft: '0.15rem' }}>
                  ⌘K
                </span>
              </button>
              <button
                type="button"
                className="icon-button"
                onClick={() => deckRef.current?.toggleOverview()}
                aria-label="Slide overview"
                title="Slide overview (Esc)"
              >
                <GridIcon />
              </button>
              <button
                type="button"
                className="icon-button"
                onClick={() => setLineNumbers((value) => !value)}
                aria-pressed={lineNumbers}
                aria-label="Line numbers in code blocks"
                title="Line numbers in code blocks"
              >
                <HashIcon />
              </button>
            </>
          ) : null}

          <button
            type="button"
            className="icon-button"
            onClick={() => setTheme((value) => (value === 'dark' ? 'light' : 'dark'))}
            aria-label="Toggle light or dark theme"
            title="Toggle theme (T)"
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>

          {doc?.source === 'url' && doc.url ? (
            <button
              type="button"
              className="icon-button"
              onClick={() => void openUrl(doc.url as string)}
              aria-label="Reload from URL"
              title="Reload from URL"
              disabled={busy}
            >
              <RefreshIcon />
            </button>
          ) : null}

          {watch ? (
            <button
              type="button"
              className="icon-button"
              onClick={() => setWatching((value) => !value)}
              aria-pressed={watching}
              aria-label="Reload automatically when the file changes"
              title={watching ? 'Watching the file for changes' : 'Not watching the file'}
            >
              <WatchIcon />
            </button>
          ) : null}

          <button
            type="button"
            className="icon-button"
            onClick={() => (canWatchFiles() ? void openWithPicker() : fileInputRef.current?.click())}
            aria-label="Open a Markdown file"
            title="Open a Markdown file"
          >
            <FileIcon />
            <span>Open</span>
          </button>

          {doc ? (
            <button
              type="button"
              className="icon-button"
              onClick={() => {
                cancelPendingLoad()
                setWatch(null)
                setDoc(null)
                storeDoc(null)
              }}
              aria-label="Close document"
              title="Close document"
            >
              <CloseIcon />
            </button>
          ) : null}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.markdown,.mdown,.mkd,.mdx,.txt,text/markdown"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void openFile(file)
            event.target.value = ''
          }}
        />
      </header>

      <div className="workspace">
        {deck ? (
          <>
            <Sidebar
              deck={deck}
              currentIndex={currentIndex}
              open={sidebarOpen}
              onSelect={(index) => {
                goTo(index)
                if (window.innerWidth < 820) setSidebarOpen(false)
              }}
            />
            <div className="deck-area">
              <Deck
                ref={deckRef}
                deck={deck}
                lineNumbers={lineNumbers}
                onSlideChange={setCurrentIndex}
                onImageClick={onImageClick}
              />
            </div>
          </>
        ) : (
          <div style={{ flex: 1, minWidth: 0 }}>
            <Welcome
              dragging={dragging}
              busy={busy}
              error={error}
              onFile={(file) => void openFile(file)}
              onPick={canWatchFiles() ? () => void openWithPicker() : undefined}
              onUrl={(url) => void openUrl(url)}
              onPaste={(text) => {
                cancelPendingLoad()
                applyDoc({ name: 'Pasted Markdown', text, source: 'paste' })
              }}
              onSample={() => {
                cancelPendingLoad()
                applyDoc({ name: 'Guided tour.md', text: sampleMarkdown, source: 'sample' })
              }}
            />
          </div>
        )}
      </div>

      {deck && searchOpen ? (
        <SearchPalette deck={deck} onClose={() => setSearchOpen(false)} onSelect={goTo} />
      ) : null}

      {lightbox ? (
        <Lightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />
      ) : null}

      {dragging && deck ? <div className="drag-veil">Drop to open this Markdown file</div> : null}
    </div>
  )
}
