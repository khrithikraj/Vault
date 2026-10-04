import { useEffect, useRef, useState } from 'react'
import { Calendar, Clock, Trash2 } from 'lucide-react'
import { VaultButton } from '../ui/VaultButton'
import { VaultDialog } from '../ui/VaultDialog'
import { VaultInput } from '../ui/VaultInput'
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
  const isEditing = Boolean(reminder)
  const isStandalone = !reminder?.note_id
  const titleInputRef = useRef<HTMLInputElement>(null)

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
    <VaultDialog
      open={open}
      onClose={onClose}
      title={isEditing ? 'Edit Reminder' : 'New Reminder'}
      showClose
      closeLabel="Close reminder editor"
      className="max-w-md"
      initialFocusRef={isStandalone ? titleInputRef : undefined}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          {isEditing && onDelete && reminder ? (
            <VaultButton
              type="button"
              variant="danger"
              size="sm"
              icon={Trash2}
              onClick={() => {
                onDelete(reminder.id)
                onClose()
              }}
            >
              Delete
            </VaultButton>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <VaultButton type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </VaultButton>
            <VaultButton type="submit" form="reminder-editor-form" variant="solid" size="sm">
              {isEditing ? 'Save Changes' : 'Create Reminder'}
            </VaultButton>
          </div>
        </div>
      }
    >
      <div className="max-h-[70vh] overflow-y-auto px-1 py-1">
        <p className="mb-4 text-xs leading-relaxed text-ink-soft">
          {isStandalone ? 'Personal standalone reminder' : 'Note-attached reminder'}
        </p>

        {error ? (
          <div className="mb-4 rounded border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        ) : null}

        <form id="reminder-editor-form" onSubmit={handleSave} className="space-y-4">
          {/* Title (for standalone reminders) */}
          {isStandalone ? (
            <div>
              <label
                htmlFor="reminder-title"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-ink-soft"
              >
                Reminder Title *
              </label>
              <VaultInput
                ref={titleInputRef}
                id="reminder-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Renew car insurance, Call accountant"
                required
                maxLength={120}
              />
            </div>
          ) : null}

          {/* Recurrence Selection */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-ink-soft">
              Frequency
            </label>
            <div className="grid grid-cols-4 gap-1 rounded border border-ink/10 bg-surface p-1">
              {RECURRENCE_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setRecurrence(opt)}
                  className={`rounded py-1.5 text-xs font-medium transition-colors ${
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
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-ink-soft">
                <Calendar size={12} />
                Date *
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
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-ink-soft">
                Day of the Week
              </label>
              <div className="grid grid-cols-7 gap-1">
                {WEEKDAYS.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setDayOfWeek(day)}
                    title={formatWeekdayLabel(day)}
                    className={`rounded py-2 text-center text-[10px] font-semibold uppercase transition-colors ${
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
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-ink-soft">
              <Clock size={12} />
              Time *
            </label>
            <CustomTimePicker
              value={localTime}
              onChange={setLocalTime}
            />
          </div>
        </form>
      </div>
    </VaultDialog>
  )
}
