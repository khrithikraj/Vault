import { type ReactNode } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { VaultButton } from './ui/VaultButton'
import { VaultDialog } from './ui/VaultDialog'

type ConfirmDialogProps = {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  busy?: boolean
  busyLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

/** Shared destructive confirmation used across item, note, and document workflows. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete permanently',
  busy = false,
  busyLabel = 'Deleting…',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <VaultDialog
      open={open}
      onClose={busy ? undefined : onCancel}
      title={title}
      showClose={!busy}
      closeLabel="Cancel"
      className="max-w-sm"
      footer={
        <>
          <VaultButton
            type="button"
            variant="danger"
            size="md"
            icon={Trash2}
            onClick={onConfirm}
            disabled={busy}
            className="flex-1"
          >
            {busy ? busyLabel : confirmLabel}
          </VaultButton>
          <VaultButton type="button" variant="ghost" size="md" onClick={onCancel} disabled={busy}>
            Cancel
          </VaultButton>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          size={20}
          strokeWidth={2}
          className="mt-0.5 shrink-0 text-red-400"
          aria-hidden="true"
        />
        <div className="text-sm leading-relaxed text-ink-soft">{message}</div>
      </div>
    </VaultDialog>
  )
}