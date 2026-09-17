import type { ChecklistReminder, DailyChecklistCompletion, Weekday } from '../../types/app'
import type { ReminderRecurrence } from '../../lib/reminders'
import { ReminderControl } from './ReminderControl'

export type NoteReminderControlProps = {
  reminder?: ChecklistReminder
  dailyCompletions: DailyChecklistCompletion[]
  targetTitle?: string
  onSaveReminder: (localTime: string, recurrence?: ReminderRecurrence, dayOfWeek?: Weekday | null) => void
  onRemoveReminder: () => void
  onToggleDailyCompletion: (reminder: ChecklistReminder) => void
}

export function NoteReminderControl({
  reminder,
  dailyCompletions,
  targetTitle,
  onSaveReminder,
  onRemoveReminder,
  onToggleDailyCompletion,
}: NoteReminderControlProps) {
  return (
    <ReminderControl
      reminder={reminder}
      dailyCompletions={dailyCompletions}
      targetTitle={targetTitle}
      targetType="note"
      variant="chip"
      onSaveReminder={onSaveReminder}
      onRemoveReminder={onRemoveReminder}
      onToggleDailyCompletion={onToggleDailyCompletion}
    />
  )
}
