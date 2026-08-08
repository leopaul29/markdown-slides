import { useEffect, useRef } from 'react'

interface LightboxProps {
  src: string
  alt: string
  onClose: () => void
}

/**
 * A native modal dialog: `showModal()` brings the focus trap, Esc-to-close and
 * the backdrop with it, so none of that has to be written here.
 */
export function Lightbox({ src, alt, onClose }: LightboxProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className="lightbox"
      aria-label={alt ? `Image: ${alt}` : 'Image preview'}
      onClose={onClose}
      onClick={onClose}
    >
      <img src={src} alt={alt} />
    </dialog>
  )
}
