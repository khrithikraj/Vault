import { useEffect } from 'react'
import { type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, Trash2, X } from 'lucide-react'

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

/** Generic permanent-delete confirmation modal, mirroring the DocumentDeleteDialog
 *  overlay pattern (backdrop + panel + Escape-to-cancel). Kept at App level so the same
 *  dialog serves item/note/document purges from Recently Deleted. */
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
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onCancel])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
        >
          <motion.div
            className="term-panel term-brackets relative w-full max-w-sm overflow-hidden rounded p-6"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onCancel}
              className="term-chip absolute right-3 top-3 rounded-full p-1.5 text-ink-soft hover:text-ink"
              aria-label="Cancel"
            >
              <X size={15} />
            </button>

            <div className="flex items-start gap-3 pr-8">
              <AlertTriangle size={20} strokeWidth={2} className="mt-0.5 shrink-0 text-red-400" aria-hidden="true" />
              <div>
                <h2 className="font-display text-base font-bold uppercase tracking-tight text-ink">{title}</h2>
                <div className="mt-1.5 text-sm leading-relaxed text-ink-soft">{message}</div>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={onConfirm}
                disabled={busy}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-red-500/60 bg-red-950/50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-red-400 transition hover:bg-red-900/60 hover:text-red-300 disabled:opacity-50"
              >
                <Trash2 size={13} />
                {busy ? busyLabel : confirmLabel}
              </button>
              <button
                type="button"
                onClick={onCancel}
                disabled={busy}
                className="rounded-outline border border-ink/30 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-ink-soft hover:text-ink disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}