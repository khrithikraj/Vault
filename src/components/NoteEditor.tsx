import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Check, Plus, Trash2, X } from 'lucide-react'
import type { ChecklistItem, Note } from '../types/app'

export function NoteEditor({
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

  // Swapping notes resets editor state
  if (openedFor.current !== note.id) {
    openedFor.current = note.id
    setTitle(note.title)
    setBody(note.body)
    setChecklist(note.checklist)
    lastSaved.current = { title: note.title, body: note.body, checklist: note.checklist }
  }

  // Autosave when user pauses typing
  useEffect(() => {
    const timeout = setTimeout(() => {
      const unchanged =
        title === lastSaved.current.title &&
        body === lastSaved.current.body &&
        JSON.stringify(checklist) === JSON.stringify(lastSaved.current.checklist)
      if (unchanged) {
        return
      }
      lastSaved.current = { title, body, checklist }
      setSaving(true)
      void onUpdate({ title, body, checklist }).finally(() => setSaving(false))
    }, 600)
    return () => clearTimeout(timeout)
  }, [title, body, checklist, onUpdate])

  const addChecklistItem = () => {
    const text = newItemText.trim()
    if (!text) return
    setChecklist((current) => [...current, { id: crypto.randomUUID(), text, done: false }])
    setNewItemText('')
  }

  const updateChecklistItemText = (itemId: string, text: string) => {
    setChecklist((current) =>
      current.map((item) => (item.id === itemId ? { ...item, text } : item)),
    )
  }

  const toggleChecklistItem = (itemId: string) => {
    setChecklist((current) =>
      current.map((item) => (item.id === itemId ? { ...item, done: !item.done } : item)),
    )
  }

  const removeChecklistItem = (itemId: string) => {
    setChecklist((current) => current.filter((item) => item.id !== itemId))
  }

  const handleManualSave = async () => {
    setSaving(true)
    lastSaved.current = { title, body, checklist }
    await onUpdate({ title, body, checklist })
    setSaving(false)
  }

  const handleBack = () => {
    if (!title.trim() && !body.trim() && checklist.length === 0) {
      onDelete()
      return
    }
    onBack()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-4"
    >
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/15 pb-3">
        <button
          type="button"
          onClick={handleBack}
          className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-ink-soft hover:text-ink transition-colors"
        >
          [ ← Back to notes ]
        </button>
        <div className="flex items-center gap-2">
          {saving ? (
            <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-soft animate-pulse">
              Saving…
            </span>
          ) : (
            <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-soft/60 hidden sm:inline">
              Autosaved
            </span>
          )}
          <button
            type="button"
            onClick={() => void handleManualSave()}
            className="term-btn-primary rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide flex items-center gap-1"
          >
            <Check size={12} /> Save
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="border-ink/30 rounded-outline border px-3 py-1 text-xs font-medium uppercase tracking-wide text-red-400 hover:text-red-300 flex items-center gap-1"
          >
            <Trash2 size={12} /> Delete
          </button>
        </div>
      </div>

      {/* Note Title */}
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-widest text-ink-soft">
          Title
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title..."
          className="term-input mt-1 w-full rounded-none px-3.5 py-2.5 text-lg sm:text-xl font-bold text-ink"
        />
      </div>

      {/* Note Body */}
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-widest text-ink-soft">
          Content
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write anything down (ideas, markdown, reminders, lists)..."
          rows={6}
          className="term-input mt-1 w-full resize-y rounded-none px-3.5 py-2.5 text-sm text-ink leading-relaxed"
        />
      </div>

      {/* Checklist Section */}
      <div className="rounded border border-ink/15 p-3.5 bg-ink/5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
            Checklist ({checklist.filter((i) => i.done).length}/{checklist.length})
          </p>
        </div>

        <div className="mt-3 grid gap-2">
          {checklist.map((item) => (
            <div
              key={item.id}
              className="term-input flex items-center gap-2.5 rounded-none px-3 py-2 bg-cloud/50"
            >
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => toggleChecklistItem(item.id)}
                className="h-4 w-4 shrink-0 accent-ink cursor-pointer"
              />
              <input
                value={item.text}
                onChange={(e) => updateChecklistItemText(item.id, e.target.value)}
                placeholder="Checklist item..."
                className={`min-w-0 flex-1 bg-transparent text-sm border-none outline-none ${
                  item.done ? 'text-ink-soft line-through' : 'text-ink'
                }`}
              />
              {item.done && (
                <span className="border-accent text-accent rounded-sm border px-1 text-[9px] font-bold uppercase tracking-widest shrink-0">
                  ✓
                </span>
              )}
              <button
                type="button"
                onClick={() => removeChecklistItem(item.id)}
                className="shrink-0 text-ink-soft hover:text-red-400 p-1"
                aria-label="Remove checklist item"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <input
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addChecklistItem()
              }
            }}
            placeholder="Add new task or list item..."
            className="term-input min-w-0 flex-1 rounded-none px-3 py-2 text-sm text-ink"
          />
          <button
            type="button"
            onClick={addChecklistItem}
            className="term-btn-primary shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold uppercase tracking-wide flex items-center gap-1"
          >
            <Plus size={13} /> Add
          </button>
        </div>
      </div>
    </motion.div>
  )
}
