import type { Deck, TocEntry } from '../lib/slides'

interface SidebarProps {
  deck: Deck
  currentIndex: number
  open: boolean
  onSelect: (slideIndex: number) => void
}

export function Sidebar({ deck, currentIndex, open, onSelect }: SidebarProps) {
  return (
    <nav className="sidebar" hidden={!open} aria-label="Table of contents">
      <p
        className="muted"
        style={{ padding: '0.25rem 0.6rem 0.6rem', fontSize: '0.7rem', letterSpacing: '0.12em' }}
      >
        CONTENTS
      </p>
      {deck.toc.map((entry) => (
        <TocNode
          key={entry.slideIndex}
          entry={entry}
          currentIndex={currentIndex}
          slides={deck.slides}
          onSelect={onSelect}
        />
      ))}
    </nav>
  )
}

function TocNode({
  entry,
  currentIndex,
  slides,
  onSelect,
}: {
  entry: TocEntry
  currentIndex: number
  slides: Deck['slides']
  onSelect: (slideIndex: number) => void
}) {
  // A section stays highlighted while the reader is on any of its parts.
  const current = slides[currentIndex]
  const active = current !== undefined && current.h === slides[entry.slideIndex]?.h

  return (
    <>
      <button
        type="button"
        className={`toc-item level-${Math.max(entry.level, 1)}${active ? ' active' : ''}`}
        onClick={() => onSelect(entry.slideIndex)}
        aria-current={active ? 'true' : undefined}
      >
        {entry.title}
      </button>
      {entry.children.map((child) => (
        <TocNode
          key={child.slideIndex}
          entry={child}
          currentIndex={currentIndex}
          slides={slides}
          onSelect={onSelect}
        />
      ))}
    </>
  )
}
