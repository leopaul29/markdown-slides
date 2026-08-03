import { useEffect, useMemo, useRef, useState } from 'react'
import { searchDeck } from '../lib/search'
import { useDialogFocus } from '../lib/useDialogFocus'
import type { Deck } from '../lib/slides'

interface SearchPaletteProps {
  deck: Deck
  onClose: () => void
  onSelect: (slideIndex: number) => void
}

const RESULT_ID_PREFIX = 'search-result-'

export function SearchPalette({ deck, onClose, onSelect }: SearchPaletteProps) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const paletteRef = useDialogFocus<HTMLDivElement>()

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
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={paletteRef}
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Search document"
        onKeyDown={onKeyDown}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search headings, text, lists and code…"
          aria-label="Search query"
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls="search-results"
          aria-activedescendant={
            results.length > 0 ? `${RESULT_ID_PREFIX}${selected}` : undefined
          }
          autoComplete="off"
        />
        <div className="palette-results" id="search-results" role="listbox" ref={listRef}>
          {query.trim() !== '' && results.length === 0 ? (
            <p className="muted" style={{ padding: '0.9rem' }}>
              No matches in this document.
            </p>
          ) : null}
          {results.map((result, index) => (
            <button
              type="button"
              key={`${result.slide.index}-${index}`}
              id={`${RESULT_ID_PREFIX}${index}`}
              role="option"
              aria-selected={index === selected}
              tabIndex={-1}
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
          <span style={{ marginLeft: 'auto' }} aria-live="polite">
            {results.length} result{results.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>
    </div>
  )
}
