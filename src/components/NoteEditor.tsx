import { useEffect, useRef, useState } from 'react'
import { motion, Reorder, useDragControls } from 'motion/react'
import { Bell, BellOff, Check, GripVertical, Loader2, Plus, Share2, Trash2, X } from 'lucide-react'
import type { ChecklistItem, ChecklistReminder, DailyChecklistCompletion, Note, Weekday } from '../types/app'
import { createSharedNote } from '../lib/share'
import { formatNoteForClipboard } from '../lib/quickActions'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { CopyButton } from './CopyButton'
import { ShareStatusPanel } from './ShareStatusPanel'
import { FavoriteButton } from './ui/FavoriteButton'
import { isNoteFavorite } from '../lib/favorites'
import { browserTimezone, noteReminder, reminderForItem, type ReminderRecurrence } from '../lib/reminders'
import { getNotificationStatus, type NotificationStatus } from '../lib/notifications'
import { NoteReminderControl } from './notes/NoteReminderControl'
import { ReminderControl } from './notes/ReminderControl'

export function NoteEditor({
  note,
  onBack,
  onDelete,
  onUpdate,
  reminders,
  dailyCompletions,
  onUpsertReminder,
  onRemoveReminder,
  onToggleDailyCompletion,
  onEnableNotifications,
  onDisableNotifications,
}: {
  note: Note
  onBack: () => void
  onDelete: () => void
  onUpdate: (patch: Partial<Pick<Note, 'title' | 'body' | 'checklist' | 'is_favorite'>>) => Promise<void>
  reminders: ChecklistReminder[]
  dailyCompletions: DailyChecklistCompletion[]
  onUpsertReminder: (input: { checklistItemId?: string | null; localTime: string; enabled: boolean; recurrence?: ReminderRecurrence; dayOfWeek?: Weekday | null; timezone?: string }) => void
  onRemoveReminder: (reminderId: string) => void
  onToggleDailyCompletion: (reminder: ChecklistReminder) => void
  onEnableNotifications: () => Promise<{ message?: string }>
  onDisableNotifications: () => Promise<{ message?: string }>
}) {
  const [title, setTitle] = useState(note.title)
  const [body, setBody] = useState(note.body)
  const [checklist, setChecklist] = useState<ChecklistItem[]>(note.checklist)
  const [newItemText, setNewItemText] = useState('')
  const [saving, setSaving] = useState(false)
  const openedFor = useRef(note.id)
  const lastSaved = useRef({ title: note.title, body: note.body, checklist: note.checklist })
  const reducedMotion = usePrefersReducedMotion()
  const [shareState, setShareState] = useState<'idle' | 'sharing' | 'done' | 'error'>('idle')
  const [shareUrl, setShareUrl] = useState('')
  const [shareError, setShareError] = useState('')
  const [notificationMessage, setNotificationMessage] = useState('')
  const [notificationStatus, setNotificationStatus] = useState<NotificationStatus | null>(null)
  const [notificationBusy, setNotificationBusy] = useState(false)

  const currentNoteReminder = noteReminder(reminders, note.id)

  useEffect(() => {
    void getNotificationStatus().then(setNotificationStatus)
  }, [])

  // Swapping notes resets editor state
  if (openedFor.current !== note.id) {
    openedFor.current = note.id
    setTitle(note.title)
    setBody(note.body)
    setChecklist(note.checklist)
    lastSaved.current = { title: note.title, body: note.body, checklist: note.checklist }
    setShareState('idle')
    setShareUrl('')
    setShareError('')
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
    // Don't leave an orphan daily reminder for a checklist item that no longer exists.
    const reminder = reminderForItem(reminders, note.id, itemId)
    if (reminder) onRemoveReminder(reminder.id)
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

  const handleShare = async () => {
    if (shareState === 'sharing') return
    setShareState('sharing')
    setShareError('')
    try {
      const { url } = await createSharedNote({ ...note, title, body, checklist })
      setShareUrl(url)
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({ title: title || note.title, text: `Check this out on Raj's Vault`, url })
          setShareState('idle')
          return
        } catch {
          // User cancelled the sheet — leave the copy panel open.
        }
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
      }
      setShareState('done')
      window.setTimeout(() => setShareState('idle'), 3000)
    } catch (err) {
      setShareState('error')
      setShareUrl('')
      setShareError(err instanceof Error ? err.message : 'Unknown error.')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex w-full max-w-full min-w-0 flex-col gap-4"
    >
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2 border-b border-ink/15 pb-3">
        <button
          type="button"
          onClick={handleBack}
          className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-ink-soft hover:text-ink transition-colors"
        >
          [ ← Back to notes ]
        </button>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {notificationStatus?.kind === 'enabled' ? (
            <button
              type="button"
              disabled={notificationBusy}
              onClick={() => {
                setNotificationBusy(true)
                void onDisableNotifications()
                  .then((result) => setNotificationMessage(result.message ?? 'Notifications disabled.'))
                  .finally(() => {
                    setNotificationBusy(false)
                    void getNotificationStatus().then(setNotificationStatus)
                  })
              }}
              className="vault-chip flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap"
            >
              <BellOff size={12} /> Notifications on
            </button>
          ) : notificationStatus?.kind === 'unsupported' ? (
            <span
              className="vault-chip flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap opacity-60"
              title={notificationStatus.message}
            >
              <Bell size={12} /> Push not supported
            </span>
          ) : notificationStatus?.kind === 'denied' ? (
            <span
              className="vault-chip flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap opacity-60"
              title={notificationStatus.message}
            >
              <Bell size={12} /> Notifications blocked
            </span>
          ) : (
            <button
              type="button"
              disabled={notificationBusy}
              onClick={() => {
                setNotificationBusy(true)
                void onEnableNotifications()
                  .then((result) => setNotificationMessage(result.message ?? ''))
                  .finally(() => {
                    setNotificationBusy(false)
                    void getNotificationStatus().then(setNotificationStatus)
                  })
              }}
              className="vault-chip flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap"
            >
              {notificationBusy ? <Loader2 size={12} className="animate-spin" /> : <Bell size={12} />} Enable notifications
            </button>
          )}

          <NoteReminderControl
            reminder={currentNoteReminder}
            dailyCompletions={dailyCompletions}
            targetTitle={title || note.title}
            onSaveReminder={(localTime, recurrence, dayOfWeek) =>
              onUpsertReminder({
                checklistItemId: null,
                localTime,
                enabled: true,
                recurrence,
                dayOfWeek,
                timezone: browserTimezone(),
              })
            }
            onRemoveReminder={() => {
              if (currentNoteReminder) onRemoveReminder(currentNoteReminder.id)
            }}
            onToggleDailyCompletion={onToggleDailyCompletion}
          />

          <FavoriteButton
            active={isNoteFavorite(note)}
            label={isNoteFavorite(note) ? 'Remove from favorites' : 'Add to favorites'}
            onToggle={() => void onUpdate({ is_favorite: !isNoteFavorite(note) })}
          />
          {saving ? (
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
              <Loader2 size={10} className="animate-spin" /> Saving…
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void handleShare()}
            className="vault-chip flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap"
          >
            <Share2 size={12} /> Share
          </button>
          <button
            type="button"
            onClick={() => void handleManualSave()}
            className="vault-btn-solid rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide flex items-center gap-1 whitespace-nowrap"
          >
            <Check size={12} /> Save
          </button>
          <CopyButton text={formatNoteForClipboard({ title, body, checklist })} label="Copy" />
          <button
            type="button"
            onClick={onDelete}
            className="border-ink/30 rounded-outline border px-3 py-1 text-xs font-medium uppercase tracking-wide text-red-400 hover:text-red-300 flex items-center gap-1 whitespace-nowrap"
          >
            <Trash2 size={12} /> Delete
          </button>
        </div>
      </div>

      <ShareStatusPanel
        state={shareState}
        url={shareUrl}
        error={shareError}
        onCopy={() => {
          if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(shareUrl)
          setShareState('done')
          window.setTimeout(() => setShareState('idle'), 3000)
        }}
      />
      {notificationMessage ? <p className="text-xs text-ink-soft" role="status">{notificationMessage}</p> : null}

      {/* Note Title */}
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-widest text-ink-soft">
          Title
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title..."
          className="vault-input mt-1 w-full min-w-0 rounded-none px-3.5 py-2.5 text-lg sm:text-xl font-bold text-ink"
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
          className="vault-input mt-1 w-full min-w-0 resize-y rounded-none px-3.5 py-2.5 text-sm text-ink leading-relaxed"
        />
      </div>

      {/* Checklist Section */}
      <div className="rounded border border-ink/15 p-3.5 bg-ink/5 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
            Checklist ({checklist.filter((i) => i.done).length}/{checklist.length})
          </p>
        </div>

        <div className="mt-3 flex min-w-0 flex-col gap-2">
          {checklist.length > 1 ? (
            <p className="text-[10px] text-ink-soft/50">Drag the handle to reorder.</p>
          ) : null}
          <Reorder.Group
            axis="y"
            values={checklist}
            onReorder={setChecklist}
            className="flex min-w-0 flex-col gap-2"
          >
            {checklist.map((item) => (
              <ChecklistRow
                key={item.id}
                item={item}
                reducedMotion={reducedMotion}
                itemReminder={reminderForItem(reminders, note.id, item.id)}
                dailyCompletions={dailyCompletions}
                onToggle={() => toggleChecklistItem(item.id)}
                onTextChange={(text) => updateChecklistItemText(item.id, text)}
                onRemove={() => removeChecklistItem(item.id)}
                onSetItemReminder={(localTime, recurrence, dayOfWeek) =>
                  onUpsertReminder({
                    checklistItemId: item.id,
                    localTime,
                    enabled: true,
                    recurrence,
                    dayOfWeek,
                    timezone: reminderForItem(reminders, note.id, item.id)?.timezone ?? browserTimezone(),
                  })
                }
                onRemoveItemReminder={() => {
                  const r = reminderForItem(reminders, note.id, item.id)
                  if (r) onRemoveReminder(r.id)
                }}
                onToggleDailyCompletion={onToggleDailyCompletion}
              />
            ))}
          </Reorder.Group>
        </div>

        <div className="mt-3 flex min-w-0 gap-2">
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
            className="vault-input min-w-0 flex-1 rounded-none px-3 py-2 text-sm text-ink"
          />
          <button
            type="button"
            onClick={addChecklistItem}
            className="vault-btn-solid shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold uppercase tracking-wide flex items-center gap-1"
          >
            <Plus size={13} /> Add
          </button>
        </div>
      </div>
    </motion.div>
  )
}

/** One draggable checklist row — clean by default, with an unobtrusive unified item-level reminder control. */
function ChecklistRow({
  item,
  reducedMotion,
  itemReminder,
  dailyCompletions,
  onToggle,
  onTextChange,
  onRemove,
  onSetItemReminder,
  onRemoveItemReminder,
  onToggleDailyCompletion,
}: {
  item: ChecklistItem
  reducedMotion: boolean
  itemReminder?: ChecklistReminder
  dailyCompletions: DailyChecklistCompletion[]
  onToggle: () => void
  onTextChange: (text: string) => void
  onRemove: () => void
  onSetItemReminder: (localTime: string, recurrence?: ReminderRecurrence, dayOfWeek?: Weekday | null) => void
  onRemoveItemReminder: () => void
  onToggleDailyCompletion: (reminder: ChecklistReminder) => void
}) {
  const controls = useDragControls()

  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      layout={reducedMotion ? undefined : true}
      transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }}
      className="vault-input flex w-full min-w-0 max-w-full items-center gap-2 overflow-visible rounded-none px-2 py-2 bg-cloud/50"
    >
      <button
        type="button"
        onPointerDown={(event) => controls.start(event)}
        className="shrink-0 cursor-grab touch-none p-1 text-ink-soft/50 hover:text-ink active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical size={15} />
      </button>
      <input
        type="checkbox"
        checked={item.done}
        onChange={onToggle}
        className="h-4 w-4 shrink-0 accent-ink cursor-pointer"
      />
      <input
        value={item.text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="Checklist item..."
        className={`w-full min-w-0 flex-1 bg-transparent text-sm border-none outline-none ${
          item.done ? 'text-ink-soft line-through' : 'text-ink'
        }`}
      />
      <span className="flex shrink-0 items-center gap-1.5 relative">
        {/* Unobtrusive unified item-level reminder control */}
        <ReminderControl
          reminder={itemReminder}
          dailyCompletions={dailyCompletions}
          targetTitle={item.text}
          targetType="item"
          variant="item-button"
          onSaveReminder={onSetItemReminder}
          onRemoveReminder={onRemoveItemReminder}
          onToggleDailyCompletion={onToggleDailyCompletion}
        />
        {item.done && (
          <span className="border-accent text-accent rounded-sm border px-1 text-[9px] font-bold uppercase tracking-widest shrink-0">
            ✓
          </span>
        )}
        {/* Direct delete button */}
        <button
          type="button"
          onClick={onRemove}
          className="p-1 text-ink-soft/40 hover:text-red-400 transition-colors"
          aria-label="Remove item"
        >
          <X size={14} />
        </button>
      </span>
    </Reorder.Item>
  )
}

