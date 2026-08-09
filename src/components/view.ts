import type { DocumentModel } from '../engine'

/** The views the reader can switch between. Persisted, so keep the names stable. */
export type ViewName = 'presentation' | 'book'

export const VIEWS: { name: ViewName; label: string; description: string }[] = [
  {
    name: 'presentation',
    label: 'Presentation',
    description: 'One section at a time, navigated with the arrow keys',
  },
  { name: 'book', label: 'Book', description: 'One continuous page, scrolled' },
]

export function isViewName(value: string | undefined): value is ViewName {
  return VIEWS.some((view) => view.name === value)
}

/**
 * What the app can ask of a view. Deliberately tiny: position is a segment
 * index, which every view understands, so switching views keeps the reader's
 * place without either view knowing the other exists.
 */
export interface ViewHandle {
  goTo(index: number): void
  /** Presentation only — the toolbar hides the control for views without it. */
  toggleOverview?(): void
}

export interface ViewProps {
  model: DocumentModel
  lineNumbers: boolean
  onSegmentChange: (index: number) => void
  onImageClick: (src: string, alt: string) => void
}
