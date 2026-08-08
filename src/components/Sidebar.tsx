import type { Deck } from '../lib/slides'

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
      {deck.toc.map((entry) => {
        // A section stays highlighted while the reader is on any of its parts,
        // which follow its first slide in reading order.
        const first = deck.slides[entry.slideIndex]
        const active =
          first !== undefined &&
          currentIndex >= entry.slideIndex &&
          currentIndex < entry.slideIndex + first.partCount

        return (
          <button
            key={entry.slideIndex}
            type="button"
            className={`toc-item level-${Math.max(entry.level, 1)}${active ? ' active' : ''}`}
            onClick={() => onSelect(entry.slideIndex)}
            aria-current={active ? 'true' : undefined}
          >
            {entry.title}
          </button>
        )
      })}
    </nav>
  )
}
