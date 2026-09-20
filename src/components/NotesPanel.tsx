import { useEffect, useState } from 'react'
import { NoteCard } from './NoteCard'
import { SortMenu } from './ui/SortMenu'
import { VaultEmptyState } from './ui/VaultEmptyState'
import { VaultSection } from './ui/VaultSection'
import { sortNotes, NOTE_SORT_OPTIONS } from '../lib/sort'
import type { NoteSortKey } from '../lib/sort'
import type { Note } from '../types/app'

type NotesPanelProps = {
  notes: Note[]
  onOpenNote: (noteId: string) => void
  onDeleteNote: (noteId: string) => void
  onToggleFavorite: (note: Note) => void
}

/** Dedicated notes section — separate from the category vault — for freeform text and
 * checklists. Grid view shows every note as a card; tapping one opens the note editor overlay.
 * New notes are created through the global quick-add control, not a section button. */
export function NotesPanel({ notes, onOpenNote, onDeleteNote, onToggleFavorite }: NotesPanelProps) {
  const [sortKey, setSortKey] = useState<NoteSortKey>(() => {
    if (typeof window === 'undefined') return 'newest'
    return (window.localStorage.getItem('vault:noteSort') as NoteSortKey | null) ?? 'newest'
  })
  useEffect(() => {
    window.localStorage.setItem('vault:noteSort', sortKey)
  }, [sortKey])

  return (
    <VaultSection
      className="mt-10"
      label="Notes"
      folio="01"
      title="Notes"
      right={
        <div className="flex items-center gap-2">
          <SortMenu value={sortKey} options={NOTE_SORT_OPTIONS} onChange={setSortKey} />
        </div>
      }
    >

      {notes.length === 0 ? (
        <VaultEmptyState
          title="No notes yet"
          description="Create a note to keep text and checklists together."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {sortNotes(notes, sortKey).map((note, index) => (
            <NoteCard
              key={note.id}
              note={note}
              index={index}
              onClick={() => onOpenNote(note.id)}
              onDelete={() => onDeleteNote(note.id)}
              onToggleFavorite={() => onToggleFavorite(note)}
            />
          ))}
        </div>
      )}
    </VaultSection>
  )
}
