import { useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { NotebookPen, X } from 'lucide-react'
import type { Note } from '../types/app'
import { NoteEditor } from './NoteEditor'

export function NoteDetailOverlay({
  note,
  onClose,
  onDelete,
  onUpdate,
}: {
  note: Note | null
  onClose: () => void
  onDelete: () => void
  onUpdate: (patch: Partial<Pick<Note, 'title' | 'body' | 'checklist'>>) => Promise<void>
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  return (
    <AnimatePresence>
      {note && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="term-panel term-brackets term-scrollbar relative flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded p-4 sm:p-6"
            style={{ transformPerspective: 1200 }}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          >
            <div className="flex items-center justify-between gap-3 border-b border-ink/15 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <NotebookPen size={18} className="text-accent" />
                <h2 className="font-display text-base sm:text-lg font-bold uppercase tracking-tight text-ink">
                  Note Editor
                </h2>
              </div>
              <button
                type="button"
                className="term-chip rounded-full p-1.5 text-ink-soft hover:text-ink"
                onClick={onClose}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="term-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1">
              <NoteEditor
                note={note}
                onBack={onClose}
                onDelete={onDelete}
                onUpdate={onUpdate}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
