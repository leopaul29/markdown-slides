import { useEffect, useMemo, useRef, useState } from 'react'
import { searchDeck } from '../lib/search'
import type { Deck } from '../lib/slides'

interface SearchPaletteProps {
  deck: Deck
  onClose: () => void
  onSelect: (slideIndex: number) => void
}

export function SearchPalette({ deck, onClose, onSelect }: SearchPaletteProps) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const results = useMemo(() => searchDeck(deck, query), [deck, query])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setSelected(0)
  }, [query])

  useEffect(() => {
    listRef.current
      ?.querySelector('.palette-result.selected')
      ?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  const commit = (index: number) => {
    const result = results[index]
    if (!result) return
    onSelect(result.slide.index)
    onClose()
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelected((value) => Math.min(value + 1, Math.max(results.length - 1, 0)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelected((value) => Math.max(value - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      commit(selected)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
    // Arrow keys must not reach Reveal's global keyboard handler.
    event.stopPropagation()
  }

  return (
    <div
      className="overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Search document"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="palette" onKeyDown={onKeyDown}>
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search headings, text, lists and code…"
          aria-label="Search query"
        />
        <div className="palette-results" ref={listRef}>
          {query.trim() !== '' && results.length === 0 ? (
            <p className="muted" style={{ padding: '0.9rem' }}>
              No matches in this document.
            </p>
          ) : null}
          {results.map((result, index) => (
            <button
              type="button"
              key={`${result.slide.index}-${index}`}
              className={`palette-result${index === selected ? ' selected' : ''}`}
              onMouseEnter={() => setSelected(index)}
              onClick={() => commit(index)}
            >
              <span className="result-title">
                {result.slide.group ? (
                  <span className="muted">{result.slide.group} › </span>
                ) : null}
                {result.slide.title || 'Overview'}
                {result.slide.partCount > 1 ? (
                  <span className="muted">
                    {' '}
                    ({result.slide.part}/{result.slide.partCount})
                  </span>
                ) : null}
              </span>
              <span className="result-snippet">
                {result.before}
                {result.match ? <mark>{result.match}</mark> : null}
                {result.after}
              </span>
            </button>
          ))}
        </div>
        <div className="palette-foot">
          <span>
            <span className="kbd">↑</span> <span className="kbd">↓</span> navigate
          </span>
          <span>
            <span className="kbd">↵</span> jump to slide
          </span>
          <span>
            <span className="kbd">Esc</span> close
          </span>
          <span style={{ marginLeft: 'auto' }}>
            {results.length} result{results.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>
    </div>
  )
}
