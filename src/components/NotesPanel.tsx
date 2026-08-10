import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { NotebookPen, X } from 'lucide-react'
import { BrandIcon } from '../lib/icons'
import type { ChecklistItem, Note } from '../types/app'

type NotesPanelProps = {
  notes: Note[]
  onAddNote: () => Promise<Note | null | undefined>
  onUpdateNote: (
    noteId: string,
    patch: Partial<Pick<Note, 'title' | 'body' | 'checklist'>>,
  ) => Promise<void>
  onDeleteNote: (noteId: string) => Promise<void>
}

const prettyDate = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' })

function makeChecklistId() {
  return crypto.randomUUID()
}

/** Dedicated notes section — separate from the category vault — for freeform text and
 * checklists. Grid view shows every note as a card; tapping one opens an autosaving editor.
 * Mounted only while the Notes tab is active, so it always starts fresh on the grid. */
export function NotesPanel({ notes, onAddNote, onUpdateNote, onDeleteNote }: NotesPanelProps) {
  const [openNoteId, setOpenNoteId] = useState<string | null>(null)

  const handleAdd = async () => {
    const note = await onAddNote()
    if (note) {
      setOpenNoteId(note.id)
    }
  }

  const handleDelete = async (noteId: string) => {
    await onDeleteNote(noteId)
    setOpenNoteId((current) => (current === noteId ? null : current))
  }

  const openNote = openNoteId ? notes.find((note) => note.id === openNoteId) ?? null : null

  if (openNote) {
    return (
      <NoteEditor
        note={openNote}
        onBack={() => setOpenNoteId(null)}
        onDelete={() => void handleDelete(openNote.id)}
        onUpdate={(patch) => onUpdateNote(openNote.id, patch)}
      />
    )
  }

  return (
    <div className="mt-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold uppercase tracking-wide">
          <BrandIcon icon={NotebookPen} size={20} /> Notes
        </h2>
        <button
          type="button"
          onClick={() => void handleAdd()}
          className="term-btn-primary rounded-full px-4 py-2 text-sm font-semibold uppercase tracking-wide"
        >
          + New note
        </button>
      </div>

      {notes.length === 0 ? (
        <div className="term-panel-soft border-ink/30 rounded border-dashed p-10 text-center text-sm text-ink-soft">
          Nothing jotted down yet — tap "New note" to start.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => {
            const doneCount = note.checklist.filter((entry) => entry.done).length
            return (
              <motion.button
                layout
                key={note.id}
                type="button"
                onClick={() => setOpenNoteId(note.id)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.97 }}
                className="term-panel term-brackets grid gap-1 rounded p-4 text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-ink">
                    {note.title.trim() || 'Untitled note'}
                  </p>
                  <span className="shrink-0 text-xs text-ink-soft">
                    {prettyDate.format(new Date(note.updated_at))}
                  </span>
                </div>
                {note.body.trim() ? (
                  <p className="line-clamp-2 text-sm text-ink-soft">{note.body}</p>
                ) : null}
                {note.checklist.length > 0 ? (
                  <p className="text-xs text-ink-soft">
                    {doneCount}/{note.checklist.length} checked
                  </p>
                ) : null}
              </motion.button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function NoteEditor({
  note,
  onBack,
  onDelete,
  onUpdate,
}: {
  note: Note
  onBack: () => void
  onDelete: () => void
  onUpdate: (patch: Partial<Pick<Note, 'title' | 'body' | 'checklist'>>) => Promise<void>
}) {
  const [title, setTitle] = useState(note.title)
  const [body, setBody] = useState(note.body)
  const [checklist, setChecklist] = useState<ChecklistItem[]>(note.checklist)
  const [newItemText, setNewItemText] = useState('')
  const [saving, setSaving] = useState(false)
  const openedFor = useRef(note.id)
  const lastSaved = useRef({ title: note.title, body: note.body, checklist: note.checklist })

  // Swapping to a different note resets the editor to that note's own content.
  if (openedFor.current !== note.id) {
    openedFor.current = note.id
    setTitle(note.title)
    setBody(note.body)
    setChecklist(note.checklist)
    lastSaved.current = { title: note.title, body: note.body, checklist: note.checklist }
  }

  // Autosave shortly after the person stops typing/toggling — skipped when nothing actually
  // changed, so opening a note (or switching between them) never fires a redundant write.
  useEffect(() => {
    const timeout = setTimeout(() => {
      const unchanged =
        title === lastSaved.current.title &&
        body === lastSaved.current.body &&
        checklist === lastSaved.current.checklist
      if (unchanged) {
        return
      }
      lastSaved.current = { title, body, checklist }
      setSaving(true)
      void onUpdate({ title, body, checklist }).finally(() => setSaving(false))
    }, 600)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body, checklist])

  const addChecklistItem = () => {
    const text = newItemText.trim()
    if (!text) {
      return
    }
    setChecklist((current) => [...current, { id: makeChecklistId(), text, done: false }])
    setNewItemText('')
  }

  const toggleChecklistItem = (itemId: string) => {
    setChecklist((current) =>
      current.map((item) => (item.id === itemId ? { ...item, done: !item.done } : item)),
    )
  }

  const removeChecklistItem = (itemId: string) => {
    setChecklist((current) => current.filter((item) => item.id !== itemId))
  }

  // Leaving an untouched, fully empty note behind would just clutter the grid — drop it instead.
  const handleBack = () => {
    if (!title.trim() && !body.trim() && checklist.length === 0) {
      onDelete()
      return
    }
    onBack()
  }

  return (
    <div className="term-panel term-brackets mx-auto mt-4 max-w-2xl rounded p-6">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleBack}
          className="text-sm font-medium uppercase tracking-wide text-ink-soft hover:text-ink"
        >
          [ ← Back to notes ]
        </button>
        <div className="flex items-center gap-2">
          {saving ? (
            <span className="text-xs uppercase tracking-widest text-ink-soft">Saving…</span>
          ) : null}
          <button
            type="button"
            onClick={onDelete}
            className="border-ink/30 rounded-outline border px-3 py-1 text-xs font-medium uppercase tracking-wide text-ink-soft hover:text-ink"
          >
            Delete
          </button>
        </div>
      </div>

      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Title"
        className="term-input mt-4 w-full rounded-none px-3 py-2 text-lg font-semibold text-ink"
      />

      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Start typing…"
        rows={5}
        className="term-input mt-3 w-full resize-none rounded-none px-3 py-2 text-sm text-ink"
      />

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">Checklist</p>
        <div className="mt-2 grid gap-1.5">
          {checklist.map((item) => (
            <div key={item.id} className="term-input flex items-center gap-2 rounded-none px-3 py-2">
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => toggleChecklistItem(item.id)}
                className="h-4 w-4 shrink-0 accent-ink"
              />
              <span
                className={`flex-1 text-sm ${item.done ? 'text-ink-soft line-through' : 'text-ink'}`}
              >
                {item.text}
              </span>
              <button
                type="button"
                onClick={() => removeChecklistItem(item.id)}
                className="shrink-0 text-ink-soft hover:text-ink"
                aria-label="Remove checklist item"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-2 flex gap-2">
          <input
            value={newItemText}
            onChange={(event) => setNewItemText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                addChecklistItem()
              }
            }}
            placeholder="Add a checklist item"
            className="term-input min-w-0 flex-1 rounded-none px-3 py-2 text-sm text-ink"
          />
          <button
            type="button"
            onClick={addChecklistItem}
            className="term-btn-primary shrink-0 rounded-full px-3 py-2 text-sm font-medium uppercase tracking-wide"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
