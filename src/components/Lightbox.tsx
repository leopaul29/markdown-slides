import { useEffect } from 'react'
import { useDialogFocus } from '../lib/useDialogFocus'

interface LightboxProps {
  src: string
  alt: string
  onClose: () => void
}

export function Lightbox({ src, alt, onClose }: LightboxProps) {
  const containerRef = useDialogFocus<HTMLDivElement>()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [onClose])

  return (
    <div
      ref={containerRef}
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={alt ? `Image: ${alt}` : 'Image preview'}
      tabIndex={-1}
      onClick={onClose}
    >
      <img src={src} alt={alt} />
    </div>
  )
}
