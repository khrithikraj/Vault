import { NotebookPen, Plus } from 'lucide-react'
import { BrandIcon } from '../lib/icons'
import { NoteCard } from './NoteCard'
import type { Note } from '../types/app'

type NotesPanelProps = {
  notes: Note[]
  onAddNote: () => Promise<Note | null | undefined>
  onOpenNote: (noteId: string) => void
  onDeleteNote: (noteId: string) => void
}

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
          {notes.map((note, index) => (
            <NoteCard
              key={note.id}
              note={note}
              index={index}
              onClick={() => onOpenNote(note.id)}
              onDelete={() => onDeleteNote(note.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
