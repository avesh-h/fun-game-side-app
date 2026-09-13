import { useCallback, useState, type ReactNode } from 'react'
import { Button } from './Button'
import { Modal } from './Modal'

export interface ConfirmOptions {
  readonly title: string
  readonly body?: ReactNode
  readonly confirmLabel?: string
  readonly cancelLabel?: string
  readonly tone?: 'danger' | 'primary'
  readonly onConfirm: () => void
}

/**
 * Ask before doing something that cannot be taken back.
 *
 * Used for wiping the session and scrapping a hand — both of which destroy
 * real records of a night in progress. Everything else in this app is
 * undoable, so everything else just happens.
 *
 *   const { confirm, dialog } = useConfirm()
 *   <Button onClick={() => confirm({ title: 'Sure?', onConfirm: wipe })}>…</Button>
 *   {dialog}
 */
export function useConfirm(): {
  confirm: (options: ConfirmOptions) => void
  dialog: ReactNode
} {
  const [pending, setPending] = useState<ConfirmOptions | null>(null)

  const confirm = useCallback((options: ConfirmOptions) => setPending(options), [])
  const close = useCallback(() => setPending(null), [])

  const dialog = (
    <Modal
      open={pending !== null}
      onClose={close}
      title={pending?.title ?? ''}
      footer={
        <div className="flex gap-2">
          <Button fullWidth onClick={close}>
            {pending?.cancelLabel ?? 'Cancel'}
          </Button>
          <Button
            fullWidth
            variant={pending?.tone === 'danger' ? 'danger' : 'primary'}
            onClick={() => {
              pending?.onConfirm()
              close()
            }}
          >
            {pending?.confirmLabel ?? 'Confirm'}
          </Button>
        </div>
      }
    >
      <div className="text-sm text-muted">{pending?.body ?? 'This cannot be undone.'}</div>
    </Modal>
  )

  return { confirm, dialog }
}
