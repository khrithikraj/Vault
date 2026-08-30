import { useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { FolderLock, NotebookPen, Plus, X } from 'lucide-react'

type AddMenuProps = {
  open: boolean
  onClose: () => void
  onPickItem: () => void
  onPickNote: () => void
  onPickDocument: () => void
}

/** Smart Quick Add chooser — shown when tapped from the Everything view where the
 *  context doesn't imply a single kind. Mirrors the overlay pattern of AddMenu's
 *  siblings (backdrop → panel, Escape closes). */
export function AddMenu({ open, onClose, onPickItem, onPickNote, onPickDocument }: AddMenuProps) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[55] flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="term-panel term-brackets w-full max-w-sm overflow-hidden rounded p-5"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-sm font-bold uppercase tracking-wider text-ink">
                Quick add
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="term-chip rounded-full p-1.5 text-ink-soft hover:text-ink"
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </div>

            <div className="grid gap-2">
              <button
                type="button"
                onClick={onPickItem}
                className="term-btn-soft flex items-center gap-3 rounded p-3 text-left"
              >
                <span className="bg-ink/10 flex h-9 w-9 items-center justify-center rounded-full">
                  <Plus size={16} className="text-accent" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-ink">Save an item</span>
                  <span className="block text-xs text-ink-soft">A thing you own, with its details</span>
                </span>
              </button>
              <button
                type="button"
                onClick={onPickNote}
                className="term-btn-soft flex items-center gap-3 rounded p-3 text-left"
              >
                <span className="bg-ink/10 flex h-9 w-9 items-center justify-center rounded-full">
                  <NotebookPen size={16} className="text-warn" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-ink">Write a note</span>
                  <span className="block text-xs text-ink-soft">A quick thought or checklist</span>
                </span>
              </button>
              <button
                type="button"
                onClick={onPickDocument}
                className="term-btn-soft flex items-center gap-3 rounded p-3 text-left"
              >
                <span className="bg-ink/10 flex h-9 w-9 items-center justify-center rounded-full">
                  <FolderLock size={16} className="text-accent" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-ink">Add a document</span>
                  <span className="block text-xs text-ink-soft">A PDF or photo of a paper record</span>
                </span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}