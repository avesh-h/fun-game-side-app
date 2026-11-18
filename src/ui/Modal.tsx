import { useEffect, useRef, type ReactNode } from 'react'
import { useBackHandler } from '../platform/backButton'

interface ModalProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly title: string
  readonly children: ReactNode
  readonly footer?: ReactNode
  /** Wide enough for the 52-card grid. Default is the narrow dialog width. */
  readonly size?: 'sm' | 'lg'
}

export function Modal({ open, onClose, title, children, footer, size = 'sm' }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Android Back closes the popup, not the screen behind it.
  useBackHandler(
    () => {
      onClose()
      return true
    },
    { layer: 'modal', enabled: open },
  )

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)

    // Stop the page behind from scrolling under the sheet.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    panelRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        // The backdrop closes the dialog; clicks inside it must not.
        onClick={(e) => e.stopPropagation()}
        className={[
          'safe-b flex max-h-[90dvh] w-full flex-col overflow-hidden',
          'rounded-t-2xl border border-line bg-surface sm:rounded-2xl',
          size === 'lg' ? 'sm:max-w-lg' : 'sm:max-w-sm',
        ].join(' ')}
      >
        <header className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 flex size-9 items-center justify-center rounded-lg text-muted active:bg-raised"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>

        {footer && <footer className="border-t border-line-soft px-4 py-3">{footer}</footer>}
      </div>
    </div>
  )
}
