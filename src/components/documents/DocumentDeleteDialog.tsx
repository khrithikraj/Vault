/**
 * DocumentDeleteDialog — confirmation modal before permanently deleting a document.
 *
 * Uses the same fixed-inset overlay pattern as ItemDetailOverlay / NoteDetailOverlay:
 * AnimatePresence → motion.div backdrop → motion.div panel.
 * Pressing Escape cancels (matches all other overlays).
 */

import { useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, Trash2, X } from 'lucide-react'
import type { VaultDocument } from '../../types/app'

type DocumentDeleteDialogProps = {
  doc: VaultDocument | null
  deleting: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function DocumentDeleteDialog({
  doc,
  deleting,
  onConfirm,
  onCancel,
}: DocumentDeleteDialogProps) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onCancel])

  return (
    <AnimatePresence>
      {doc && (
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
            {/* Close button */}
            <button
              type="button"
              onClick={onCancel}
              className="term-chip absolute right-3 top-3 rounded-full p-1.5 text-ink-soft hover:text-ink"
              aria-label="Cancel"
            >
              <X size={15} />
            </button>

            {/* Icon + heading */}
            <div className="flex items-start gap-3 pr-8">
              <AlertTriangle
                size={20}
                strokeWidth={2}
                className="mt-0.5 shrink-0 text-red-400"
                aria-hidden="true"
              />
              <div>
                <h2 className="font-display text-base font-bold uppercase tracking-tight text-ink">
                  Delete document?
                </h2>
                <p className="mt-1.5 text-sm text-ink-soft leading-relaxed">
                  <span className="font-semibold text-ink">{doc.name}</span>
                  {' '}will be permanently removed from Vault — both the file and its record.
                  This cannot be undone.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={onConfirm}
                disabled={deleting}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-red-500/60 bg-red-950/50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-red-400 transition hover:bg-red-900/60 hover:text-red-300 disabled:opacity-50"
              >
                <Trash2 size={13} />
                {deleting ? 'Deleting…' : 'Delete permanently'}
              </button>
              <button
                type="button"
                onClick={onCancel}
                disabled={deleting}
                className="rounded-outline border border-ink/30 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-ink-soft hover:text-ink disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
