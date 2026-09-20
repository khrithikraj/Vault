import type { Ref } from 'react'
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
  open?: boolean
  onOpenChange?: (open: boolean) => void
  triggerRef?: Ref<HTMLButtonElement>
  hideTrigger?: boolean
}

export function NoteReminderControl({
  reminder,
  dailyCompletions,
  targetTitle,
  onSaveReminder,
  onRemoveReminder,
  onToggleDailyCompletion,
  open,
  onOpenChange,
  triggerRef,
  hideTrigger,
}: NoteReminderControlProps) {
  return (
    <ReminderControl
      reminder={reminder}
      dailyCompletions={dailyCompletions}
      targetTitle={targetTitle}
      targetType="note"
      variant="chip"
      open={open}
      onOpenChange={onOpenChange}
      triggerRef={triggerRef}
      hideTrigger={hideTrigger}
      onSaveReminder={onSaveReminder}
      onRemoveReminder={onRemoveReminder}
      onToggleDailyCompletion={onToggleDailyCompletion}
    />
  )
}
