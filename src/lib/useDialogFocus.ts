import { useEffect, useRef } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Gives a `role="dialog"` element the behaviour that role promises: focus moves
 * inside on open, Tab stays within it, and the previously focused control gets
 * focus back on close.
 */
export function useDialogFocus<T extends HTMLElement>(active = true) {
  const containerRef = useRef<T>(null)

  useEffect(() => {
    if (!active) return
    const container = containerRef.current
    if (!container) return

    const previous = document.activeElement as HTMLElement | null

    // Only take focus if the dialog has not already placed it (the search
    // palette focuses its own input).
    if (!container.contains(document.activeElement)) {
      const first = container.querySelector<HTMLElement>(FOCUSABLE)
      ;(first ?? container).focus()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const targets = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) => element.offsetParent !== null || element === document.activeElement,
      )
      if (targets.length === 0) {
        event.preventDefault()
        container.focus()
        return
      }
      const first = targets[0]
      const last = targets[targets.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    container.addEventListener('keydown', onKeyDown)
    return () => {
      container.removeEventListener('keydown', onKeyDown)
      previous?.focus?.()
    }
  }, [active])

  return containerRef
}
