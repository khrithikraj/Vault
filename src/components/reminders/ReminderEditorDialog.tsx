import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Bell, Calendar, Clock, Trash2, X } from 'lucide-react'
import { layers } from '../../design/layers'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { CustomTimePicker } from '../ui/CustomTimePicker'
import { CustomDatePicker } from '../ui/CustomDatePicker'
import {
  browserTimezone,
  formatRecurrenceLabel,
  formatWeekdayLabel,
  isValidFireOnDate,
  validateReminderTime,
  WEEKDAYS,
  zonedDateStr,
  zonedWeekday,
  type ReminderRecurrence,
} from '../../lib/reminders'
import type { ChecklistReminder, Weekday } from '../../types/app'

export type ReminderEditorDialogProps = {
  open: boolean
  reminder?: ChecklistReminder | null
  onClose: () => void
  onSave: (input: {
    id?: string
    title: string
    localTime: string
    recurrence: ReminderRecurrence
    dayOfWeek?: Weekday | null
    fireOnDate?: string | null
    enabled: boolean
  }) => void
  onDelete?: (id: string) => void
}

const RECURRENCE_OPTIONS: ReminderRecurrence[] = ['once', 'daily', 'weekdays', 'weekly']

export function ReminderEditorDialog({
  open,
  reminder,
  onClose,
  onSave,
  onDelete,
}: ReminderEditorDialogProps) {
  const reducedMotion = usePrefersReducedMotion()
  const isEditing = Boolean(reminder)
  const isStandalone = !reminder?.note_id

  const [title, setTitle] = useState('')
  const [localTime, setLocalTime] = useState('09:00')
  const [recurrence, setRecurrence] = useState<ReminderRecurrence>('daily')
  const [dayOfWeek, setDayOfWeek] = useState<Weekday>('monday')
  const [fireOnDate, setFireOnDate] = useState<string>('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      if (reminder) {
        setTitle(reminder.title || '')
        setLocalTime(reminder.local_time.slice(0, 5))
        setRecurrence(reminder.recurrence)
        setDayOfWeek(
          reminder.day_of_week ||
            zonedWeekday(new Date(), reminder.timezone || browserTimezone()),
        )
        setFireOnDate(
          isValidFireOnDate(reminder.fire_on_date)
            ? (reminder.fire_on_date as string)
            : zonedDateStr(new Date(), reminder.timezone || browserTimezone()),
        )
      } else {
        setTitle('')
        setLocalTime('09:00')
        setRecurrence('daily')
        setDayOfWeek(zonedWeekday(new Date(), browserTimezone()))
        setFireOnDate(zonedDateStr(new Date(), browserTimezone()))
      }
      setError('')
    }
  }, [open, reminder])

  if (!open) return null

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (isStandalone && !title.trim()) {
      setError('Please enter a reminder title.')
      return
    }
    if (!validateReminderTime(localTime)) {
      setError('Please choose a valid reminder time.')
      return
    }
    if (recurrence === 'once' && !isValidFireOnDate(fireOnDate)) {
      setError('Please select a date for your reminder.')
      return
    }

    onSave({
      id: reminder?.id,
      title: title.trim(),
      localTime,
      recurrence,
      dayOfWeek: recurrence === 'weekly' ? dayOfWeek : null,
      fireOnDate: recurrence === 'once' ? fireOnDate : null,
      enabled: reminder ? reminder.enabled : true,
    })
    onClose()
  }

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        style={{ zIndex: layers.modal }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reminder-dialog-title"
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal Window */}
        <motion.div
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 8 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-md overflow-hidden rounded-2xl border border-ink/15 bg-surface-deep p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-ink/10 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
                <Bell size={16} />
              </div>
              <div>
                <h2
                  id="reminder-dialog-title"
                  className="font-display text-base font-semibold text-ink"
                >
                  {isEditing ? 'Edit Reminder' : 'New Reminder'}
                </h2>
                <p className="text-xs text-ink-soft/60">
                  {isStandalone ? 'Personal standalone reminder' : 'Note-attached reminder'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-ink-soft/50 transition-colors hover:bg-ink/5 hover:text-ink"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSave} className="mt-5 space-y-4">
            {error ? (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                {error}
              </div>
            ) : null}

            {/* Title (for standalone reminders) */}
            {isStandalone ? (
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-ink-soft/70">
                  Reminder Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Renew car insurance, Call accountant"
                  autoFocus
                  className="vault-input w-full rounded-xl px-3.5 py-2.5 text-sm"
                  maxLength={120}
                />
              </div>
            ) : null}

            {/* Recurrence Selection */}
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-ink-soft/70">
                Frequency
              </label>
              <div className="grid grid-cols-4 gap-1 rounded-xl border border-ink/10 bg-surface p-1">
                {RECURRENCE_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setRecurrence(opt)}
                    className={`rounded-lg py-1.5 text-xs font-medium transition-colors ${
                      recurrence === opt
                        ? 'bg-accent font-semibold text-ink shadow-sm'
                        : 'text-ink-soft/70 hover:text-ink'
                    }`}
                  >
                    {formatRecurrenceLabel(opt)}
                  </button>
                ))}
              </div>
            </div>

            {/* Exact Date for Once */}
            {recurrence === 'once' ? (
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-soft/70">
                  <Calendar size={12} />
                  Date
                </label>
                <CustomDatePicker
                  value={fireOnDate}
                  onChange={setFireOnDate}
                />
              </div>
            ) : null}

            {/* Day of Week for Weekly */}
            {recurrence === 'weekly' ? (
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-ink-soft/70">
                  Day of the Week
                </label>
                <div className="grid grid-cols-7 gap-1">
                  {WEEKDAYS.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setDayOfWeek(day)}
                      title={formatWeekdayLabel(day)}
                      className={`rounded-lg py-2 text-center text-[10px] font-semibold uppercase transition-colors ${
                        dayOfWeek === day
                          ? 'border border-accent bg-accent/20 text-accent'
                          : 'border border-ink/10 bg-surface text-ink-soft/60 hover:text-ink'
                      }`}
                    >
                      {formatWeekdayLabel(day).slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Time Picker */}
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-soft/70">
                <Clock size={12} />
                Time
              </label>
              <CustomTimePicker
                value={localTime}
                onChange={setLocalTime}
              />
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-3">
              {isEditing && onDelete ? (
                <button
                  type="button"
                  onClick={() => {
                    if (reminder) onDelete(reminder.id)
                    onClose()
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-red-400/80 transition-colors hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 size={13} />
                  Delete
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg px-4 py-2 text-xs font-medium text-ink-soft/70 transition-colors hover:bg-ink/5 hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-accent px-5 py-2 text-xs font-semibold uppercase tracking-wider text-ink transition-opacity hover:opacity-90"
                >
                  {isEditing ? 'Save Changes' : 'Create Reminder'}
                </button>
              </div>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
