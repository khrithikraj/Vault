import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import { motion, Reorder, useDragControls } from 'motion/react'
import { Bell, BellOff, Check, Clock, Copy, GripVertical, Loader2, Plus, Share2, Trash2 } from 'lucide-react'
import type { ChecklistItem, ChecklistReminder, DailyChecklistCompletion, Note, Weekday } from '../types/app'
import { createSharedNote } from '../lib/share'
import { formatNoteForClipboard } from '../lib/quickActions'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { ShareStatusPanel } from './ShareStatusPanel'
import { FavoriteButton } from './ui/FavoriteButton'
import { MoreActionsMenu, type MoreActionItem } from './ui/MoreActionsMenu'
import { isNoteFavorite } from '../lib/favorites'
import { browserTimezone, formatRecurrenceLabel, formatReminderTime, isCompletedToday, noteReminder, reminderForItem, type ReminderRecurrence } from '../lib/reminders'
import { getNotificationStatus, type NotificationStatus } from '../lib/notifications'
import { cn } from '../design/cn'
import { NoteReminderControl } from './notes/NoteReminderControl'
import { ReminderControl } from './notes/ReminderControl'

/** Editorial metadata date — DD MMM (03 SEP), driven by the same recency
 *  timestamp the rest of the Vault uses. Deterministic 3-letter months so the
 *  label always reads "03 SEP" regardless of locale. */
const META_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function formatMetaDate(iso: string): string {
  const date = new Date(iso)
  const day = String(date.getDate()).padStart(2, '0')
  return `${day} ${META_MONTHS[date.getMonth()]}`
}

export function NoteEditor({
  note,
  onDelete,
  onUpdate,
  reminders,
  dailyCompletions,
  onUpsertReminder,
  onRemoveReminder,
  onToggleDailyCompletion,
  onEnableNotifications,
  onDisableNotifications,
  registerCloseHandler,
}: {
  note: Note
  onDelete: () => void
  onUpdate: (patch: Partial<Pick<Note, 'title' | 'body' | 'checklist' | 'is_favorite'>>) => Promise<void>
  reminders: ChecklistReminder[]
  dailyCompletions: DailyChecklistCompletion[]
  onUpsertReminder: (input: { checklistItemId?: string | null; localTime: string; enabled: boolean; recurrence?: ReminderRecurrence; dayOfWeek?: Weekday | null; timezone?: string }) => void
  onRemoveReminder: (reminderId: string) => void
  onToggleDailyCompletion: (reminder: ChecklistReminder) => void
  onEnableNotifications: () => Promise<{ message?: string }>
  onDisableNotifications: () => Promise<{ message?: string }>
  /** Lets the surrounding overlay ask the editor how to close. A handler returns
   *  `true` when it has handled the close itself (e.g. deleting an empty note). */
  registerCloseHandler?: (handler: () => boolean) => void
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
  const [reminderOpen, setReminderOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [reorderMode, setReorderMode] = useState(false)
  const moreActionsRef = useRef<HTMLButtonElement | null>(null) as MutableRefObject<HTMLButtonElement | null>
  const reminderAnchorRef = useRef<HTMLButtonElement | null>(null) as MutableRefObject<HTMLButtonElement | null>
  const reminderChipMounted = useRef(false)
  const setMoreActionsNode = useCallback((node: HTMLButtonElement | null) => {
    moreActionsRef.current = node
    if (!reminderChipMounted.current) reminderAnchorRef.current = node
  }, [])
  const setReminderChipNode = useCallback((node: HTMLButtonElement | null) => {
    reminderChipMounted.current = node !== null
    reminderAnchorRef.current = node ?? moreActionsRef.current
  }, [])

  const currentNoteReminder = noteReminder(reminders, note.id)
  const isReminderDoneToday = Boolean(
    currentNoteReminder?.enabled && isCompletedToday(currentNoteReminder, dailyCompletions),
  )
  const metaDate = formatMetaDate(note.updated_at || note.created_at)

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
    setReminderOpen(false)
    setReorderMode(false)
  }

  // Closing the editor once kept the "back" semantics: an empty note is discarded
  // (soft-deleted), anything with content is simply closed.
  useEffect(() => {
    registerCloseHandler?.(() => {
      if (!title.trim() && !body.trim() && checklist.length === 0) {
        onDelete()
        return true
      }
      return false
    })
  }, [registerCloseHandler, title, body, checklist, onDelete])

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

  const handleCopyNote = async () => {
    const text = formatNoteForClipboard({ title, body, checklist })
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.setAttribute('readonly', '')
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        try {
          document.execCommand('copy')
        } finally {
          document.body.removeChild(textarea)
        }
      }
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard unavailable — stay quiet.
    }
  }

  const toggleNotifications = () => {
    if (notificationBusy) return
    setNotificationBusy(true)
    const enabling = notificationStatus?.kind !== 'enabled'
    const action = enabling ? onEnableNotifications() : onDisableNotifications()
    void action
      .then((result) => setNotificationMessage(result.message ?? (enabling ? '' : 'Notifications disabled.')))
      .finally(() => {
        setNotificationBusy(false)
        void getNotificationStatus().then(setNotificationStatus)
      })
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

  const reminderTrailing = currentNoteReminder?.enabled
    ? isReminderDoneToday
      ? `Done today · ${formatReminderTime(currentNoteReminder.local_time)}`
      : `${formatRecurrenceLabel(currentNoteReminder.recurrence)} · ${formatReminderTime(currentNoteReminder.local_time)}`
    : undefined
  const reminderTime = currentNoteReminder?.enabled ? formatReminderTime(currentNoteReminder.local_time) : undefined
  const reminderChipLabel = currentNoteReminder?.enabled
    ? isReminderDoneToday
      ? `Done today · ${reminderTime}`
      : `${formatRecurrenceLabel(currentNoteReminder.recurrence)} reminder at ${reminderTime}`
    : 'Set reminder'

  const notificationsItem: MoreActionItem = (() => {
    switch (notificationStatus?.kind) {
      case 'enabled':
        return {
          id: 'notifications',
          label: 'Disable notifications',
          icon: BellOff,
          disabled: notificationBusy,
          onSelect: toggleNotifications,
        }
      case 'denied':
        return {
          id: 'notifications',
          label: 'Notifications blocked',
          icon: Bell,
          disabled: true,
          title: notificationStatus.message,
          onSelect: () => {},
        }
      case 'unsupported':
        return {
          id: 'notifications',
          label: 'Push not supported',
          icon: Bell,
          disabled: true,
          title: notificationStatus.message,
          onSelect: () => {},
        }
      default:
        return {
          id: 'notifications',
          label: 'Enable notifications',
          icon: Bell,
          disabled: notificationBusy,
          onSelect: toggleNotifications,
        }
    }
  })()

  const moreItems: MoreActionItem[] = [
    { id: 'save', label: 'Save', icon: Check, onSelect: () => void handleManualSave() },
    { id: 'share', label: 'Share', icon: Share2, onSelect: () => void handleShare() },
    { id: 'reminder', label: 'Reminder', icon: Clock, trailing: reminderTrailing, onSelect: () => setReminderOpen(true) },
    notificationsItem,
    { id: 'copy', label: copied ? 'Copied' : 'Copy', icon: copied ? Check : Copy, onSelect: () => void handleCopyNote() },
    { id: 'delete', label: 'Delete', icon: Trash2, danger: true, divider: true, onSelect: onDelete },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex w-full max-w-full min-w-0 flex-col gap-4"
    >
      {/* Header row — the editable title sits on one line with the quick actions.
          Only favorite and  ⋯  stay visible; an active reminder surfaces its own
          time chip (◷ 09:25 AM), which doubles as the reminder picker trigger. */}
      <div className="border-b border-ink/15 pb-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-soft">
          Note · {metaDate}
        </p>
        <div className="mt-1.5 flex min-w-0 items-start gap-1.5 sm:gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title..."
            aria-label="Note title"
            className="min-w-0 flex-1 bg-transparent px-1 py-1.5 font-display text-xl sm:text-2xl font-semibold leading-tight text-ink outline-none placeholder:font-body placeholder:text-base placeholder:font-normal placeholder:leading-normal placeholder:text-ink-soft/50"
          />
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <FavoriteButton
              active={isNoteFavorite(note)}
              label={isNoteFavorite(note) ? 'Remove from favorites' : 'Add to favorites'}
              onToggle={() => void onUpdate({ is_favorite: !isNoteFavorite(note) })}
            />
            {currentNoteReminder?.enabled ? (
              <button
                ref={setReminderChipNode}
                type="button"
                onClick={() => setReminderOpen((prev) => !prev)}
                aria-expanded={reminderOpen}
                aria-haspopup="dialog"
                aria-label={reminderChipLabel}
                title={reminderChipLabel}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-sm border px-2 py-0.5 text-xs font-medium transition-colors',
                  isReminderDoneToday
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                    : 'border-accent/20 bg-accent/5 text-accent hover:bg-accent/15',
                )}
              >
                {isReminderDoneToday ? (
                  <Check size={12} className="shrink-0 stroke-[2.5]" aria-hidden="true" />
                ) : (
                  <Clock size={12} className="shrink-0" aria-hidden="true" />
                )}
                <span>{reminderTime}</span>
              </button>
            ) : null}
            <MoreActionsMenu triggerRef={setMoreActionsNode} triggerLabel="More actions" items={moreItems} />
          </div>
        </div>

        {saving || notificationMessage ? (
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            {saving ? (
              <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                <Loader2 size={10} className="animate-spin" /> Saving…
              </span>
            ) : null}
            {notificationMessage ? (
              <p className="min-w-0 text-xs text-ink-soft" role="status">{notificationMessage}</p>
            ) : null}
          </div>
        ) : null}

        {/* Reminder popover lives here; its chip trigger is hidden and it anchors to the
            visible time chip (or the ⋯ button while no reminder exists yet). */}
        <NoteReminderControl
          reminder={currentNoteReminder}
          dailyCompletions={dailyCompletions}
          targetTitle={title || note.title}
          open={reminderOpen}
          onOpenChange={setReminderOpen}
          triggerRef={reminderAnchorRef}
          hideTrigger
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

      {/* Note Body — editorial writing surface */}
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-widest text-ink-soft">
          Content
        </label>
        <div className="mt-1.5 border-b border-dashed border-ink/15" aria-hidden="true" />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write anything down (ideas, markdown, reminders, lists)..."
          rows={6}
          className="mt-3 w-full min-w-0 resize-y bg-transparent text-sm text-ink leading-relaxed outline-none placeholder:text-ink-soft/50"
        />
      </div>

      {/* Checklist Section */}
      <div className="rounded border border-ink/15 p-3.5 bg-ink/5 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
            Checklist ({checklist.filter((i) => i.done).length}/{checklist.length})
          </p>
          {checklist.length > 1 ? (
            <button
              type="button"
              onClick={() => setReorderMode((mode) => !mode)}
              aria-pressed={reorderMode}
              className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink"
            >
              {reorderMode ? (
                <Check size={11} className="shrink-0 stroke-[2.5]" aria-hidden="true" />
              ) : (
                <GripVertical size={11} className="shrink-0" aria-hidden="true" />
              )}
              {reorderMode ? 'Done' : 'Reorder'}
            </button>
          ) : null}
        </div>

        <div className="mt-3 flex min-w-0 flex-col gap-2">
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
                reorderMode={reorderMode && checklist.length > 1}
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

/** One checklist row. Normal mode keeps it minimal — checkbox, task text, a subtle
 *  reminder indicator (when one exists) and a ⋯ menu. Reminder editing and deletion
 *  live in the ⋯ menu. The drag handle appears only during Reorder mode. */
function ChecklistRow({
  item,
  reducedMotion,
  itemReminder,
  dailyCompletions,
  reorderMode,
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
  reorderMode: boolean
  onToggle: () => void
  onTextChange: (text: string) => void
  onRemove: () => void
  onSetItemReminder: (localTime: string, recurrence?: ReminderRecurrence, dayOfWeek?: Weekday | null) => void
  onRemoveItemReminder: () => void
  onToggleDailyCompletion: (reminder: ChecklistReminder) => void
}) {
  const controls = useDragControls()
  const [reminderOpen, setReminderOpen] = useState(false)
  const moreButtonRef = useRef<HTMLButtonElement | null>(null)

  const isDoneToday = Boolean(itemReminder?.enabled && isCompletedToday(itemReminder, dailyCompletions))
  const reminderLabel = itemReminder?.enabled
    ? isDoneToday
      ? `Done today · ${formatReminderTime(itemReminder.local_time)}`
      : `${formatRecurrenceLabel(itemReminder.recurrence)} reminder at ${formatReminderTime(itemReminder.local_time)}`
    : 'Set item reminder'

  const moreItems: MoreActionItem[] = [
    {
      id: 'reminder',
      label: itemReminder?.enabled ? 'Edit reminder' : 'Set reminder',
      icon: Bell,
      onSelect: () => setReminderOpen(true),
    },
    { id: 'delete', label: 'Delete', icon: Trash2, danger: true, divider: true, onSelect: onRemove },
  ]

  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      layout={reducedMotion ? undefined : true}
      transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }}
      className="vault-input flex w-full min-w-0 max-w-full items-center gap-2 overflow-visible rounded-none px-2 py-1 bg-cloud/50"
    >
      {reorderMode ? (
        <button
          type="button"
          onPointerDown={(event) => controls.start(event)}
          className="flex h-10 w-10 shrink-0 cursor-grab touch-none items-center justify-center rounded text-ink-soft/50 hover:bg-ink/5 hover:text-ink active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <GripVertical size={15} />
        </button>
      ) : null}
      <label className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center">
        <input
          type="checkbox"
          checked={item.done}
          onChange={onToggle}
          aria-label={`Mark "${item.text}" as done`}
          className="h-4 w-4 shrink-0 accent-ink cursor-pointer"
        />
      </label>
      <input
        value={item.text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="Checklist item..."
        className={`w-full min-w-0 flex-1 bg-transparent text-sm border-none outline-none ${
          item.done ? 'text-ink-soft line-through' : 'text-ink'
        }`}
      />
      {!reorderMode ? (
        <span className="flex shrink-0 items-center gap-1.5">
          {itemReminder?.enabled ? (
            <span
              aria-label={reminderLabel}
              title={reminderLabel}
              className={`inline-flex shrink-0 items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] transition-colors ${
                isDoneToday
                  ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
                  : 'border-accent/20 bg-accent/5 text-accent'
              }`}
            >
              {isDoneToday ? (
                <Check size={10} className="shrink-0 stroke-[2.5]" aria-hidden="true" />
              ) : (
                <Clock size={10} className="shrink-0" aria-hidden="true" />
              )}
              <span>{formatReminderTime(itemReminder.local_time)}</span>
            </span>
          ) : null}
          {item.done ? (
            <span className="border-accent text-accent rounded-sm border px-1 text-[9px] font-bold uppercase tracking-widest shrink-0" aria-hidden="true">
              ✓
            </span>
          ) : null}
          <MoreActionsMenu
            triggerLabel={`More actions for ${item.text.trim() || 'item'}`}
            triggerRef={moreButtonRef}
            items={moreItems}
            align="right"
          />
        </span>
      ) : null}

      <ReminderControl
        reminder={itemReminder}
        dailyCompletions={dailyCompletions}
        targetTitle={item.text}
        targetType="item"
        variant="item-button"
        open={reminderOpen}
        onOpenChange={setReminderOpen}
        triggerRef={moreButtonRef}
        hideTrigger
        onSaveReminder={onSetItemReminder}
        onRemoveReminder={onRemoveItemReminder}
        onToggleDailyCompletion={onToggleDailyCompletion}
      />
    </Reorder.Item>
  )
}

