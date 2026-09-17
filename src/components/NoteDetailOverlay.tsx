import type { ChecklistReminder, DailyChecklistCompletion, Note, Weekday } from '../types/app'
import type { ReminderRecurrence } from '../lib/reminders'
import { NoteEditor } from './NoteEditor'
import { VaultDialog } from './ui/VaultDialog'

export function NoteDetailOverlay({
  note,
  onClose,
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
  note: Note | null
  onClose: () => void
  onDelete: () => void
  onUpdate: (patch: Partial<Pick<Note, 'title' | 'body' | 'checklist' | 'is_favorite'>>) => Promise<void>
  reminders: ChecklistReminder[]
  dailyCompletions: DailyChecklistCompletion[]
  onUpsertReminder: (input: { noteId: string; checklistItemId?: string | null; localTime: string; enabled: boolean; recurrence?: ReminderRecurrence; dayOfWeek?: Weekday | null; timezone?: string }) => void
  onRemoveReminder: (reminderId: string) => void
  onToggleDailyCompletion: (reminder: ChecklistReminder) => void
  onEnableNotifications: () => Promise<{ message?: string }>
  onDisableNotifications: () => Promise<{ message?: string }>
}) {
  return (
    <VaultDialog
      open={note !== null}
      onClose={onClose}
      title="Note editor"
      showClose
      className="max-w-2xl"
      bodyClassName="vault-scrollbar max-h-[calc(100dvh-8rem)] min-w-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6"
    >
      {note ? (
        <NoteEditor
          note={note}
          onBack={onClose}
          onDelete={onDelete}
          onUpdate={onUpdate}
          reminders={reminders}
          dailyCompletions={dailyCompletions}
          onUpsertReminder={(input) => onUpsertReminder({ ...input, noteId: note.id })}
          onRemoveReminder={onRemoveReminder}
          onToggleDailyCompletion={onToggleDailyCompletion}
          onEnableNotifications={onEnableNotifications}
          onDisableNotifications={onDisableNotifications}
        />
      ) : null}
    </VaultDialog>
  )
}
