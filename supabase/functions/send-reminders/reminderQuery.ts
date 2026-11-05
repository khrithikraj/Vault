export const REMINDER_SELECT_WITH_WEEKDAYS =
  'id,user_id,title,note_id,checklist_item_id,recurrence,day_of_week,weekdays,fire_on_date,local_time,timezone,next_fire_at,notes(title,deleted_at,checklist)'

export const REMINDER_SELECT_LEGACY =
  'id,user_id,title,note_id,checklist_item_id,recurrence,day_of_week,fire_on_date,local_time,timezone,next_fire_at,notes(title,deleted_at,checklist)'

export function isMissingWeekdaysColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  const message = error.message ?? ''
  return /weekdays.*(does not exist|could not find|schema cache)/i.test(message) ||
    (error.code === '42703' && /weekdays/i.test(message))
}

export async function fetchReminderRows<T>(
  load: (selection: string) => Promise<{ data: T[] | null; error: { code?: string; message?: string } | null }>,
): Promise<{ data: T[] | null; error: { code?: string; message?: string } | null }> {
  const current = await load(REMINDER_SELECT_WITH_WEEKDAYS)
  if (!isMissingWeekdaysColumnError(current.error)) return current
  return load(REMINDER_SELECT_LEGACY)
}
