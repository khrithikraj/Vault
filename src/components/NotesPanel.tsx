import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { NoteCard } from './NoteCard'
import { SortMenu } from './ui/SortMenu'
import { VaultEmptyState } from './ui/VaultEmptyState'
import { VaultSection } from './ui/VaultSection'
import { sortNotes, NOTE_SORT_OPTIONS } from '../lib/sort'
import type { NoteSortKey } from '../lib/sort'
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
  const [sortKey, setSortKey] = useState<NoteSortKey>(() => {
    if (typeof window === 'undefined') return 'newest'
    return (window.localStorage.getItem('vault:noteSort') as NoteSortKey | null) ?? 'newest'
  })
  useEffect(() => {
    window.localStorage.setItem('vault:noteSort', sortKey)
  }, [sortKey])

  const handleAdd = async () => {
    const note = await onAddNote()
    if (note) {
      onOpenNote(note.id)
    }
  }

  return (
    <VaultSection
      className="mt-10"
      label="Notes"
      folio="01"
      title="Notes"
      right={
        <div className="flex items-center gap-2">
          <SortMenu value={sortKey} options={NOTE_SORT_OPTIONS} onChange={setSortKey} />
          <button
            type="button"
            onClick={() => void handleAdd()}
            className="vault-btn-solid rounded-full px-4 py-2 text-xs sm:text-sm font-semibold uppercase tracking-wide flex items-center gap-1.5"
          >
            <Plus size={15} /> New note
          </button>
        </div>
      }
    >

      {notes.length === 0 ? (
        <VaultEmptyState
          title="No notes yet"
          description="Create a note to keep text and checklists together."
        />
      ) : (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {sortNotes(notes, sortKey).map((note, index) => (
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
    </VaultSection>
  )
}
