import { motion } from 'motion/react'
import { NotebookPen, Plus, Trash2 } from 'lucide-react'
import { BrandIcon } from '../lib/icons'
import type { Note } from '../types/app'

type NotesPanelProps = {
  notes: Note[]
  onAddNote: () => Promise<Note | null | undefined>
  onOpenNote: (noteId: string) => void
  onDeleteNote: (noteId: string) => void
}

const prettyDate = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' })

/** Dedicated notes section — separate from the category vault — for freeform text and
 * checklists. Grid view shows every note as a card; tapping one opens the note editor overlay. */
export function NotesPanel({ notes, onAddNote, onOpenNote, onDeleteNote }: NotesPanelProps) {
  const handleAdd = async () => {
    const note = await onAddNote()
    if (note) {
      onOpenNote(note.id)
    }
  }

  return (
    <div className="mt-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base sm:text-lg font-bold uppercase tracking-wider text-ink">
          <BrandIcon icon={NotebookPen} size={20} /> Notes
        </h2>
        <button
          type="button"
          onClick={() => void handleAdd()}
          className="term-btn-primary rounded-full px-4 py-2 text-xs sm:text-sm font-semibold uppercase tracking-wide flex items-center gap-1.5"
        >
          <Plus size={15} /> New note
        </button>
      </div>

      {notes.length === 0 ? (
        <div className="term-panel-soft border-ink/30 rounded border-dashed p-10 text-center text-sm text-ink-soft">
          Nothing jotted down yet — tap "+ New note" to create one.
        </div>
      ) : (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((note, index) => {
            const doneCount = note.checklist.filter((entry) => entry.done).length
            const allDone = note.checklist.length > 0 && doneCount === note.checklist.length
            return (
              <motion.div
                layout
                key={note.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{
                  y: -4,
                  rotateX: -4,
                  rotateY: index % 2 === 0 ? -2 : 2,
                }}
                whileTap={{ scale: 0.98 }}
                style={{ transformPerspective: 800 }}
                onClick={() => onOpenNote(note.id)}
                className="term-panel term-brackets relative flex flex-col justify-between overflow-hidden rounded p-4 sm:p-5 text-left cursor-pointer group"
              >
                {allDone && (
                  <span className="border-accent text-accent pointer-events-none absolute right-3 top-3 -rotate-12 rounded-sm border-2 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.25em] opacity-90">
                    Done
                  </span>
                )}

                <div>
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-display font-semibold uppercase leading-snug text-ink group-hover:text-accent transition-colors text-base truncate">
                      {note.title.trim() || 'Untitled note'}
                    </p>
                    <span className="shrink-0 text-xs text-ink-soft">
                      {prettyDate.format(new Date(note.updated_at || note.created_at))}
                    </span>
                  </div>

                  {note.body.trim() ? (
                    <p className="mt-2 line-clamp-3 text-xs sm:text-sm text-ink-soft leading-relaxed">
                      {note.body}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs italic text-ink-soft/50">No text content</p>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-dashed border-ink/15 pt-2 text-xs text-ink-soft">
                  <div>
                    {note.checklist.length > 0 ? (
                      <span className="font-medium text-ink-soft">
                        {doneCount}/{note.checklist.length} tasks done
                      </span>
                    ) : (
                      <span>Note</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteNote(note.id)
                    }}
                    className="term-chip rounded-full p-1 text-ink-soft/70 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete note"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
