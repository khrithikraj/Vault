import { useState } from 'react'
import { motion } from 'motion/react'
import {
  Bell,
  Check,
  Clock,
  NotebookPen,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { VaultSection } from '../ui/VaultSection'
import { ReminderEditorDialog } from './ReminderEditorDialog'
import {
  formatRecurrenceLabel,
  formatReminderDate,
  formatReminderTime,
  formatWeekdayLabel,
  getReminderDueGroup,
  isCompletedToday,
  type DueGroup,
  type ReminderRecurrence,
} from '../../lib/reminders'
import type { ChecklistReminder, DailyChecklistCompletion, Note, Weekday } from '../../types/app'

export type RemindersPanelProps = {
  reminders: ChecklistReminder[]
  dailyCompletions: DailyChecklistCompletion[]
  notes: Note[]
  onOpenNote: (noteId: string) => void
  onUpsertReminder: (input: {
    id?: string
    title?: string | null
    noteId?: string | null
    checklistItemId?: string | null
    localTime: string
    enabled: boolean
    recurrence?: ReminderRecurrence
    dayOfWeek?: Weekday | null
    fireOnDate?: string | null
    timezone?: string
  }) => void
  onRemoveReminder: (id: string) => void
  onToggleDailyCompletion: (reminder: ChecklistReminder) => void
  onEnableNotifications?: () => Promise<{ message?: string }>
}

export function RemindersPanel({
  reminders,
  dailyCompletions,
  notes,
  onOpenNote,
  onUpsertReminder,
  onRemoveReminder,
  onToggleDailyCompletion,
  onEnableNotifications,
}: RemindersPanelProps) {
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingReminder, setEditingReminder] = useState<ChecklistReminder | null>(null)
  const [notifMessage, setNotifMessage] = useState('')

  // Map notes by ID for quick title/checklist lookup
  const notesById = new Map<string, Note>(notes.map((n) => [n.id, n]))

  // Partition reminders into active vs completed today
  const activeReminders = reminders.filter((r) => r.enabled)
  const todayCompleted = reminders.filter((r) => isCompletedToday(r, dailyCompletions))

  // Group active reminders by due date
  const groups: Record<DueGroup, ChecklistReminder[]> = {
    today: [],
    tomorrow: [],
    this_week: [],
    later: [],
  }

  for (const reminder of activeReminders) {
    // If completed today, we group it under today or separate section
    const group = getReminderDueGroup(reminder)
    groups[group].push(reminder)
  }

  // Sort reminders within groups by time
  for (const group of Object.keys(groups) as DueGroup[]) {
    groups[group].sort((a, b) => a.local_time.localeCompare(b.local_time))
  }

  const handleCreateNew = () => {
    setEditingReminder(null)
    setEditorOpen(true)
  }

  const handleEdit = (reminder: ChecklistReminder) => {
    setEditingReminder(reminder)
    setEditorOpen(true)
  }

  const handleSaveReminder = (input: {
    id?: string
    title: string
    localTime: string
    recurrence: ReminderRecurrence
    dayOfWeek?: Weekday | null
    fireOnDate?: string | null
    enabled: boolean
  }) => {
    if (editingReminder && editingReminder.note_id) {
      // Editing a note-attached reminder
      onUpsertReminder({
        id: editingReminder.id,
        noteId: editingReminder.note_id,
        checklistItemId: editingReminder.checklist_item_id,
        localTime: input.localTime,
        recurrence: input.recurrence,
        dayOfWeek: input.dayOfWeek,
        fireOnDate: input.fireOnDate,
        enabled: input.enabled,
        timezone: editingReminder.timezone,
      })
    } else {
      // Standalone reminder
      onUpsertReminder({
        id: input.id,
        title: input.title,
        noteId: null,
        checklistItemId: null,
        localTime: input.localTime,
        recurrence: input.recurrence,
        dayOfWeek: input.dayOfWeek,
        fireOnDate: input.fireOnDate,
        enabled: input.enabled,
      })
    }
  }

  const handleEnablePush = async () => {
    if (onEnableNotifications) {
      const res = await onEnableNotifications()
      if (res?.message) {
        setNotifMessage(res.message)
        setTimeout(() => setNotifMessage(''), 4000)
      }
    }
  }

  const totalCount = activeReminders.length

  return (
    <div className="space-y-8">
      {/* Header section */}
      <VaultSection
        className="mt-10"
        label="Reminders"
        folio="01"
        title="Reminders"
        right={
          <div className="flex items-center gap-3">
            <span className="vault-meta text-ink-soft/45">
              {totalCount} {totalCount === 1 ? 'reminder' : 'reminders'}
            </span>
            <button
              type="button"
              onClick={handleCreateNew}
              className="vault-action flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent hover:text-ink"
            >
              <Plus size={13} aria-hidden="true" />
              New reminder
            </button>
          </div>
        }
      >
        {/* Notification Status Banner */}
        {notifMessage ? (
          <div className="mb-4 rounded-xl border border-accent/30 bg-accent/10 px-4 py-2.5 text-xs text-ink">
            {notifMessage}
          </div>
        ) : typeof Notification !== 'undefined' && Notification.permission !== 'granted' ? (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-ink/10 bg-surface/60 px-4 py-3 text-xs text-ink-soft/75">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-accent" />
              <span>Enable browser push notifications to receive due alerts on this device.</span>
            </div>
            <button
              type="button"
              onClick={handleEnablePush}
              className="font-display shrink-0 rounded-lg border border-ink/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-ink transition-colors hover:border-accent hover:text-accent"
            >
              Enable
            </button>
          </div>
        ) : null}

        {/* Reminders List by Groups */}
        {totalCount === 0 && todayCompleted.length === 0 ? (
          <div className="mt-4 border border-dashed border-ink/12 px-6 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-deep text-ink-soft/40">
              <Bell size={24} />
            </div>
            <p className="vault-meta mt-4 text-ink-soft/45">No reminders scheduled</p>
            <p className="mt-2 text-sm text-ink-soft/70">
              Create standalone reminders or add checklists with reminders inside Notes.
            </p>
            <button
              type="button"
              onClick={handleCreateNew}
              className="vault-action mt-5 inline-flex items-center gap-2 border border-ink/15 px-4 py-2 text-xs font-medium text-ink-soft transition-colors hover:border-accent hover:text-accent"
            >
              <Plus size={13} aria-hidden="true" />
              New reminder
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* TODAY */}
            <ReminderGroupSection
              title="Today"
              count={groups.today.length}
              reminders={groups.today}
              dailyCompletions={dailyCompletions}
              notesById={notesById}
              onOpenNote={onOpenNote}
              onEdit={handleEdit}
              onDelete={onRemoveReminder}
              onToggleComplete={onToggleDailyCompletion}
            />

            {/* TOMORROW */}
            <ReminderGroupSection
              title="Tomorrow"
              count={groups.tomorrow.length}
              reminders={groups.tomorrow}
              dailyCompletions={dailyCompletions}
              notesById={notesById}
              onOpenNote={onOpenNote}
              onEdit={handleEdit}
              onDelete={onRemoveReminder}
              onToggleComplete={onToggleDailyCompletion}
            />

            {/* THIS WEEK */}
            <ReminderGroupSection
              title="This Week"
              count={groups.this_week.length}
              reminders={groups.this_week}
              dailyCompletions={dailyCompletions}
              notesById={notesById}
              onOpenNote={onOpenNote}
              onEdit={handleEdit}
              onDelete={onRemoveReminder}
              onToggleComplete={onToggleDailyCompletion}
            />

            {/* LATER */}
            <ReminderGroupSection
              title="Later"
              count={groups.later.length}
              reminders={groups.later}
              dailyCompletions={dailyCompletions}
              notesById={notesById}
              onOpenNote={onOpenNote}
              onEdit={handleEdit}
              onDelete={onRemoveReminder}
              onToggleComplete={onToggleDailyCompletion}
            />
          </div>
        )}
      </VaultSection>

      {/* Editor Modal */}
      <ReminderEditorDialog
        open={editorOpen}
        reminder={editingReminder}
        onClose={() => {
          setEditorOpen(false)
          setEditingReminder(null)
        }}
        onSave={handleSaveReminder}
        onDelete={(id) => {
          onRemoveReminder(id)
          setEditorOpen(false)
          setEditingReminder(null)
        }}
      />
    </div>
  )
}

function ReminderGroupSection({
  title,
  count,
  reminders,
  dailyCompletions,
  notesById,
  onOpenNote,
  onEdit,
  onDelete,
  onToggleComplete,
}: {
  title: string
  count: number
  reminders: ChecklistReminder[]
  dailyCompletions: DailyChecklistCompletion[]
  notesById: Map<string, Note>
  onOpenNote: (noteId: string) => void
  onEdit: (reminder: ChecklistReminder) => void
  onDelete: (id: string) => void
  onToggleComplete: (reminder: ChecklistReminder) => void
}) {
  if (count === 0) return null

  return (
    <section aria-labelledby={`heading-reminder-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="mb-3 flex items-center justify-between border-b border-ink/10 pb-2">
        <h3
          id={`heading-reminder-${title.toLowerCase().replace(/\s+/g, '-')}`}
          className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-ink"
        >
          {title}
        </h3>
        <span className="folio text-[10px] tabular-nums text-ink-soft/40">{count}</span>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {reminders.map((reminder) => {
          const isDone = isCompletedToday(reminder, dailyCompletions)
          const note = reminder.note_id ? notesById.get(reminder.note_id) : undefined
          const checklistItem =
            note && reminder.checklist_item_id
              ? note.checklist?.find((i) => i.id === reminder.checklist_item_id)
              : undefined

          // Title resolution
          const displayTitle = reminder.note_id
            ? checklistItem
              ? checklistItem.text
              : note?.title.trim() || 'Untitled note'
            : reminder.title?.trim() || 'Untitled reminder'

          return (
            <motion.div
              layout
              key={reminder.id}
              className={`group relative flex flex-col justify-between rounded-xl border p-3.5 transition-all ${
                isDone
                  ? 'border-ink/8 bg-surface/30 opacity-60'
                  : 'border-ink/12 bg-surface hover:border-ink/25 hover:shadow-sm'
              }`}
            >
              {/* Card Top: Checkbox + Title */}
              <div className="flex items-start gap-2.5">
                <button
                  type="button"
                  onClick={() => onToggleComplete(reminder)}
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded transition-colors ${
                    isDone
                      ? 'border border-accent bg-accent text-ink'
                      : 'border border-ink/30 hover:border-accent hover:bg-accent/10'
                  }`}
                  aria-label={isDone ? 'Mark reminder incomplete' : 'Mark reminder complete'}
                >
                  {isDone ? <Check size={11} strokeWidth={3} /> : null}
                </button>

                <div className="min-w-0 flex-1">
                  <h4
                    onClick={() => onEdit(reminder)}
                    className={`font-display cursor-pointer break-words text-sm font-medium leading-snug transition-colors group-hover:text-ink ${
                      isDone ? 'text-ink-soft/50 line-through' : 'text-ink'
                    }`}
                  >
                    {displayTitle}
                  </h4>

                  {/* Note link context badge */}
                  {reminder.note_id && note ? (
                    <div className="mt-1 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onOpenNote(reminder.note_id!)
                        }}
                        className="inline-flex items-center gap-1 rounded bg-ink/5 px-1.5 py-0.5 text-[10px] text-ink-soft/70 transition-colors hover:bg-ink/10 hover:text-ink"
                        title="Open note in editor"
                      >
                        <NotebookPen size={10} />
                        <span className="max-w-36 truncate">{note.title.trim() || 'Untitled Note'}</span>
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Card Bottom: Badges + Actions */}
              <div className="mt-3.5 flex items-center justify-between border-t border-ink/5 pt-2.5">
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-ink-soft/65">
                  <span className="inline-flex items-center gap-1 font-medium text-ink-soft/90">
                    <Clock size={11} className="text-accent" />
                    {formatReminderTime(reminder.local_time)}
                  </span>
                  <span>·</span>
                  <span>
                    {reminder.recurrence === 'once' && reminder.fire_on_date
                      ? formatReminderDate(reminder.fire_on_date)
                      : reminder.recurrence === 'weekly' && reminder.day_of_week
                        ? `Every ${formatWeekdayLabel(reminder.day_of_week)}`
                        : formatRecurrenceLabel(reminder.recurrence)}
                  </span>
                </div>

                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => onEdit(reminder)}
                    className="rounded p-1 text-ink-soft/45 transition-colors hover:bg-ink/5 hover:text-ink"
                    title="Edit reminder"
                    aria-label="Edit reminder"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(reminder.id)}
                    className="rounded p-1 text-ink-soft/45 transition-colors hover:bg-red-500/10 hover:text-red-400"
                    title="Delete reminder"
                    aria-label="Delete reminder"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}
