import type { DocumentModel } from '../engine'

interface SidebarProps {
  model: DocumentModel
  currentIndex: number
  open: boolean
  onSelect: (segmentIndex: number) => void
}

export function Sidebar({ model, currentIndex, open, onSelect }: SidebarProps) {
  return (
    <nav className="sidebar" hidden={!open} aria-label="Table of contents">
      <p
        className="muted"
        style={{ padding: '0.25rem 0.6rem 0.6rem', fontSize: '0.7rem', letterSpacing: '0.12em' }}
      >
        CONTENTS
      </p>
      {model.toc.map((entry) => {
        // A section stays highlighted while the reader is on any of its parts,
        // which follow its first segment in reading order.
        const section = model.sections[entry.sectionIndex]
        const active =
          section !== undefined &&
          currentIndex >= entry.segmentIndex &&
          currentIndex < entry.segmentIndex + section.segments.length

        return (
          <button
            key={entry.segmentIndex}
            type="button"
            className={`toc-item level-${Math.max(entry.level, 1)}${active ? ' active' : ''}`}
            onClick={() => onSelect(entry.segmentIndex)}
            aria-current={active ? 'true' : undefined}
          >
            {entry.title}
          </button>
        )
      })}
    </nav>
  )
}
