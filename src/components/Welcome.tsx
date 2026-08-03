import { useRef, useState } from 'react'

interface WelcomeProps {
  dragging: boolean
  busy: boolean
  error: string | null
  onFile: (file: File) => void
  onUrl: (url: string) => void
  onPaste: (text: string) => void
  onSample: () => void
}

export function Welcome({ dragging, busy, error, onFile, onUrl, onPaste, onSample }: WelcomeProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState('')
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasted, setPasted] = useState('')

  return (
    <div className="welcome">
      <div className="welcome-card">
        <h1 style={{ fontSize: '2.2rem', fontWeight: 700, letterSpacing: '-0.03em', margin: 0 }}>
          Markdown Slides
        </h1>
        <p className="muted" style={{ marginTop: '0.6rem' }}>
          Drop a Markdown file to explore it as a navigable slide deck. Everything runs locally in
          your browser — no upload, no AI, no configuration.
        </p>

        <div
          className={`dropzone${dragging ? ' dragging' : ''}`}
          onClick={() => fileInput.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') fileInput.current?.click()
          }}
        >
          <p style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>
            Drop a <code>.md</code> file here
          </p>
          <p className="muted" style={{ margin: '0.4rem 0 1.1rem', fontSize: '0.9rem' }}>
            or choose one from your machine
          </p>
          <span className="button-primary">Choose file</span>
          <input
            ref={fileInput}
            type="file"
            accept=".md,.markdown,.mdown,.mkd,.mdx,.txt,text/markdown"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) onFile(file)
              event.target.value = ''
            }}
          />
        </div>

        <form
          className="field-row"
          onSubmit={(event) => {
            event.preventDefault()
            if (url.trim()) onUrl(url)
          }}
        >
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="…or paste a URL to a Markdown file (GitHub links work too)"
            aria-label="Markdown URL"
          />
          <button type="submit" className="button-ghost" disabled={busy}>
            {busy ? 'Loading…' : 'Load'}
          </button>
        </form>

        {pasteOpen ? (
          <div style={{ marginTop: '0.8rem', textAlign: 'left' }}>
            <textarea
              className="paste-box"
              value={pasted}
              onChange={(event) => setPasted(event.target.value)}
              placeholder="Paste Markdown here…"
              aria-label="Markdown to present"
              rows={8}
            />
            <button
              type="button"
              className="button-ghost"
              style={{ marginTop: '0.5rem' }}
              onClick={() => onPaste(pasted)}
              disabled={pasted.trim() === ''}
            >
              Present pasted Markdown
            </button>
          </div>
        ) : null}

        {error ? (
          <p className="error-text" style={{ marginTop: '0.8rem' }}>
            {error}
          </p>
        ) : null}

        <div
          style={{
            display: 'flex',
            gap: '0.6rem',
            justifyContent: 'center',
            marginTop: '1.4rem',
            flexWrap: 'wrap',
          }}
        >
          <button type="button" className="button-ghost" onClick={onSample}>
            Open the example document
          </button>
          <button
            type="button"
            className="button-ghost"
            onClick={() => setPasteOpen((value) => !value)}
            aria-expanded={pasteOpen}
          >
            {pasteOpen ? 'Hide paste box' : 'Paste Markdown instead'}
          </button>
        </div>

        <p className="muted" style={{ marginTop: '1.8rem', fontSize: '0.8rem' }}>
          <span className="kbd">←</span> <span className="kbd">→</span> slides ·{' '}
          <span className="kbd">↑</span> <span className="kbd">↓</span> parts ·{' '}
          <span className="kbd">Ctrl/⌘ K</span> search · <span className="kbd">F</span> fullscreen
        </p>
      </div>
    </div>
  )
}
