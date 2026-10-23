import { useState } from 'react'
import { motion } from 'motion/react'
import {
  Bell,
  Check,
  Clock,
  NotebookPen,
  Trash2,
} from 'lucide-react'
import { VaultSection } from '../ui/VaultSection'
import { FavoriteButton } from '../ui/FavoriteButton'
import { DoneStamp } from '../DoneStamp'
import { AlarmToneCard } from './AlarmToneCard'
import {
  formatRecurrenceLabel,
  formatReminderDate,
  formatReminderTime,
  formatWeekdayLabel,
  getReminderDueGroup,
  isCompletedToday,
  type DueGroup,
} from '../../lib/reminders'
import type { ChecklistItem, ChecklistReminder, DailyChecklistCompletion, Note } from '../../types/app'

export type RemindersPanelProps = {
  reminders: ChecklistReminder[]
  dailyCompletions: DailyChecklistCompletion[]
  notes: Note[]
  onOpenNote: (noteId: string) => void
  onEditReminder: (reminder: ChecklistReminder) => void
  onRemoveReminder: (id: string) => void
  onToggleReminderFavorite: (reminder: ChecklistReminder) => void
  onToggleDailyCompletion: (reminder: ChecklistReminder) => void
  onEnableNotifications?: () => Promise<{ message?: string }>
}

export function RemindersPanel({
  reminders,
  dailyCompletions,
  notes,
  onOpenNote,
  onEditReminder,
  onRemoveReminder,
  onToggleReminderFavorite,
  onToggleDailyCompletion,
  onEnableNotifications,
}: RemindersPanelProps) {
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
    const group = getReminderDueGroup(reminder)
    groups[group].push(reminder)
  }

  // Sort reminders within groups by time
  for (const group of Object.keys(groups) as DueGroup[]) {
    groups[group].sort((a, b) => a.local_time.localeCompare(b.local_time))
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
          <span className="vault-meta text-ink-soft/45">
            {totalCount} {totalCount === 1 ? 'reminder' : 'reminders'}
          </span>
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
              className="vault-action shrink-0 rounded-lg border border-ink/20 px-3 py-1 text-xs text-ink transition-colors hover:border-accent hover:text-accent"
            >
              Enable
            </button>
          </div>
        ) : null}

        {/* Native Alarm Audio Preferences */}
        <AlarmToneCard />

        {/* Reminders List by Groups */}
        {totalCount === 0 && todayCompleted.length === 0 ? (
          <div className="mt-4 border border-dashed border-ink/12 px-6 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-deep text-ink-soft/40">
              <Bell size={24} />
            </div>
            <p className="vault-card-title mt-4 text-ink-soft/70">No reminders scheduled</p>
            <p className="vault-body-secondary mt-2 text-ink-soft/70">
              Create standalone reminders or add checklists with reminders inside Notes.
            </p>
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
              onEdit={onEditReminder}
              onDelete={onRemoveReminder}
              onToggleFavorite={onToggleReminderFavorite}
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
              onEdit={onEditReminder}
              onDelete={onRemoveReminder}
              onToggleFavorite={onToggleReminderFavorite}
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
              onEdit={onEditReminder}
              onDelete={onRemoveReminder}
              onToggleFavorite={onToggleReminderFavorite}
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
              onEdit={onEditReminder}
              onDelete={onRemoveReminder}
              onToggleFavorite={onToggleReminderFavorite}
              onToggleComplete={onToggleDailyCompletion}
            />
          </div>
        )}
      </VaultSection>
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
  onToggleFavorite,
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
  onToggleFavorite: (reminder: ChecklistReminder) => void
  onToggleComplete: (reminder: ChecklistReminder) => void
}) {
  if (count === 0) return null

  return (
    <section aria-labelledby={`heading-reminder-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="mb-3 flex items-center justify-between border-b border-ink/10 pb-2">
        <h3
          id={`heading-reminder-${title.toLowerCase().replace(/\s+/g, '-')}`}
          className="vault-group-title text-ink"
        >
          {title}
        </h3>
        <span className="vault-data text-ink-soft/40">{count}</span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {reminders.map((reminder, index) => {
          const isDone = isCompletedToday(reminder, dailyCompletions)
          const note = reminder.note_id ? notesById.get(reminder.note_id) : undefined
          const checklistItem =
            note && reminder.checklist_item_id
              ? note.checklist?.find((i) => i.id === reminder.checklist_item_id)
              : undefined

          return (
            <ReminderCard
              key={reminder.id}
              reminder={reminder}
              index={index}
              isDone={isDone}
              note={note}
              checklistItem={checklistItem}
              onOpenNote={onOpenNote}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleFavorite={onToggleFavorite}
              onToggleComplete={onToggleComplete}
            />
          )
        })}
      </div>
    </section>
  )
}

export function ReminderCard({
  reminder,
  index,
  isDone,
  note,
  checklistItem,
  onOpenNote,
  onEdit,
  onDelete,
  onToggleFavorite,
  onToggleComplete,
}: {
  reminder: ChecklistReminder
  index: number
  isDone: boolean
  note?: Note
  checklistItem?: ChecklistItem
  onOpenNote: (noteId: string) => void
  onEdit: (reminder: ChecklistReminder) => void
  onDelete: (id: string) => void
  onToggleFavorite: (reminder: ChecklistReminder) => void
  onToggleComplete: (reminder: ChecklistReminder) => void
}) {
  // Title resolution
  const displayTitle = reminder.note_id
    ? checklistItem
      ? checklistItem.text
      : note?.title.trim() || 'Untitled note'
    : reminder.title?.trim() || 'Untitled reminder'

  const scheduleText =
    reminder.recurrence === 'once' && reminder.fire_on_date
      ? formatReminderDate(reminder.fire_on_date)
      : reminder.recurrence === 'weekly' && reminder.day_of_week
        ? `Every ${formatWeekdayLabel(reminder.day_of_week)}`
        : formatRecurrenceLabel(reminder.recurrence)

  const isFav = reminder.is_favorite === true
  const favoriteLabel = isFav
    ? `Remove ${displayTitle} from favorites`
    : `Add ${displayTitle} to favorites`

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, type: 'spring', stiffness: 300, damping: 28 }}
      whileHover={{
        y: -4,
        rotateX: -3,
        rotateY: index % 2 === 0 ? -1.5 : 1.5,
      }}
      whileTap={{ scale: 0.98 }}
      style={{ transformPerspective: 800 }}
      onClick={() => onEdit(reminder)}
      className="vault-card group flex flex-col justify-between overflow-hidden cursor-pointer select-none min-h-[148px]"
      role="button"
      tabIndex={0}
      aria-label={`Edit reminder ${displayTitle}`}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        if ((event.target as HTMLElement).closest('button, a, input, textarea, select')) return
        event.preventDefault()
        onEdit(reminder)
      }}
    >
      {/* Header row: title + top-right actions (Favorite + Delete) */}
      <div className="flex items-start justify-between gap-2 px-4 pt-3 min-h-[3rem]">
        <h3
          className={`vault-card-title min-w-0 line-clamp-2 text-ink transition-colors group-hover:text-accent ${
            isDone ? 'text-ink-soft/50 line-through' : ''
          }`}
        >
          {displayTitle}
        </h3>
        <div className="flex shrink-0 items-center gap-0.5">
          <FavoriteButton
            active={isFav}
            label={favoriteLabel}
            onToggle={() => onToggleFavorite(reminder)}
            size={13}
            boxClassName="h-8 w-8"
          />
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onDelete(reminder.id)
            }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-soft/30 transition-colors hover:bg-ink/5 hover:text-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            title="Delete reminder"
            aria-label="Delete reminder"
          >
            <Trash2 size={13} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Body: note context badge or standalone reminder pill */}
      <div className="flex-1 flex items-center px-4 py-2 min-h-[2.25rem]">
        {reminder.note_id && note ? (
          <div className="flex items-center gap-1.5 overflow-hidden">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onOpenNote(reminder.note_id!)
              }}
              className="vault-meta inline-flex max-w-full items-center gap-1.5 rounded bg-ink/5 px-2 py-0.5 text-ink-soft transition-colors hover:bg-ink/10 hover:text-ink"
              title="Open note in editor"
            >
              <NotebookPen size={12} className="shrink-0 text-accent" />
              <span className="truncate font-medium">{note.title.trim() || 'Untitled Note'}</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 overflow-hidden">
            <span className="vault-meta inline-flex max-w-full items-center gap-1.5 rounded bg-ink/5 px-2 py-0.5 text-ink-soft">
              <Bell size={12} className="shrink-0 text-accent/80" />
              <span className="truncate font-medium">Standalone reminder</span>
            </span>
          </div>
        )}
      </div>

      {/* Divider + footer: time/schedule on left + Mark as Done / DoneStamp on right */}
      <div className="mx-4 h-px bg-ink/[0.07]" />
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 min-h-[2.25rem]">
        <span className="vault-meta flex min-w-0 items-center gap-1.5 text-ink-soft/50">
          <Clock size={11} className="shrink-0 text-accent" />
          <span className="vault-data text-ink-soft/80">{formatReminderTime(reminder.local_time)}</span>
          <span className="shrink-0 text-ink-soft/30" aria-hidden="true">·</span>
          <span className="truncate">{scheduleText}</span>
        </span>
        <div className="flex items-center gap-1.5">
          {isDone ? (
            <DoneStamp
              label="Mark reminder incomplete"
              onToggle={(event) => {
                event.stopPropagation()
                onToggleComplete(reminder)
              }}
            />
          ) : (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onToggleComplete(reminder)
              }}
              className="vault-action inline-flex items-center gap-1 rounded border border-ink/15 px-2 py-0.5 text-xs text-ink-soft/60 transition-colors hover:border-accent hover:bg-accent/10 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              title="Mark reminder complete"
              aria-label="Mark reminder complete"
            >
              <Check size={11} strokeWidth={2.5} />
              <span>Done</span>
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
