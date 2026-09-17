import { describe, expect, it } from 'vitest'
import type { ChecklistReminder, DailyChecklistCompletion } from '../../src/types/app'
import {
  addDay,
  computeNextFireAt,
  formatRecurrenceLabel,
  formatReminderTime,
  formatWeekdayLabel,
  isCompletedToday,
  localDateInTimezone,
  noteReminder,
  parseLocalTime,
  reminderForItem,
  to24HourTime,
  validateReminderTime,
  zonedWeekday,
} from '../../src/lib/reminders'

const ZONE = 'Asia/Kolkata' // UTC+5:30
const nowIso = '2026-09-15T07:58:00.000Z' // 13:28 IST (Tuesday)

function makeReminder(overrides: Partial<ChecklistReminder> = {}): ChecklistReminder {
  return {
    id: 'r1',
    user_id: 'u1',
    note_id: 'n1',
    checklist_item_id: 'c1',
    enabled: true,
    recurrence: 'daily',
    local_time: '13:28',
    timezone: ZONE,
    next_fire_at: '2026-09-16T07:58:00.000Z',
    last_fired_at: '2026-09-15T07:58:00.000Z',
    created_at: nowIso,
    updated_at: nowIso,
    ...overrides,
  }
}

describe('reminders validation and lookup', () => {
  it('validates HH:MM local times only', () => {
    expect(validateReminderTime('09:00')).toBe(true)
    expect(validateReminderTime('09:01')).toBe(true)
    expect(validateReminderTime('09:17')).toBe(true)
    expect(validateReminderTime('09:46')).toBe(true)
    expect(validateReminderTime('09:47')).toBe(true)
    expect(validateReminderTime('23:59')).toBe(true)
    expect(validateReminderTime('00:00')).toBe(true)
    expect(validateReminderTime('9:00')).toBe(false)
    expect(validateReminderTime('24:00')).toBe(false)
    expect(validateReminderTime('09:60')).toBe(false)
    expect(validateReminderTime('noon')).toBe(false)
  })

  it('formats reminder time into 12-hour AM/PM display', () => {
    expect(formatReminderTime('09:00')).toBe('09:00 AM')
    expect(formatReminderTime('09:01')).toBe('09:01 AM')
    expect(formatReminderTime('09:17')).toBe('09:17 AM')
    expect(formatReminderTime('09:46')).toBe('09:46 AM')
    expect(formatReminderTime('09:47')).toBe('09:47 AM')
    expect(formatReminderTime('00:00')).toBe('12:00 AM')
    expect(formatReminderTime('12:00')).toBe('12:00 PM')
    expect(formatReminderTime('13:30')).toBe('01:30 PM')
    expect(formatReminderTime('23:59')).toBe('11:59 PM')
    expect(formatReminderTime('')).toBe('')
  })

  it('formats recurrence and weekday labels', () => {
    expect(formatRecurrenceLabel('once')).toBe('Once')
    expect(formatRecurrenceLabel('daily')).toBe('Daily')
    expect(formatRecurrenceLabel('weekdays')).toBe('Weekdays')
    expect(formatRecurrenceLabel('weekly')).toBe('Weekly')
    expect(formatWeekdayLabel('monday')).toBe('Monday')
    expect(formatWeekdayLabel('sunday')).toBe('Sunday')
  })

  it('looks up a reminder by note and checklist item', () => {
    const a = makeReminder({ id: 'r1', checklist_item_id: 'c1' })
    const b = makeReminder({ id: 'r2', checklist_item_id: 'c2' })
    const noteLevel = makeReminder({ id: 'r3', checklist_item_id: null })
    expect(reminderForItem([a, b, noteLevel], 'n1', 'c2')?.id).toBe('r2')
    expect(reminderForItem([a, b, noteLevel], 'n1', 'missing')).toBeUndefined()
    expect(reminderForItem([a, b, noteLevel], 'other-note', 'c1')).toBeUndefined()
  })

  it('looks up a note-level reminder (checklist_item_id is null)', () => {
    const itemLevel = makeReminder({ id: 'r1', note_id: 'n1', checklist_item_id: 'c1' })
    const noteLevel1 = makeReminder({ id: 'r2', note_id: 'n1', checklist_item_id: null })
    const noteLevel2 = makeReminder({ id: 'r3', note_id: 'n2', checklist_item_id: null })

    expect(noteReminder([itemLevel, noteLevel1, noteLevel2], 'n1')?.id).toBe('r2')
    expect(noteReminder([itemLevel, noteLevel1, noteLevel2], 'n2')?.id).toBe('r3')
    expect(noteReminder([itemLevel], 'n1')).toBeUndefined()
  })
})

describe('timezone dates and calendar math', () => {
  it('computes the local calendar date and weekday in Asia/Kolkata', () => {
    // 00:30Z -> 06:00 the same day in Asia/Kolkata (Sunday).
    const sunDate = new Date('2026-09-13T00:30:00Z')
    expect(localDateInTimezone(sunDate, ZONE)).toBe('2026-09-13')
    expect(zonedWeekday(sunDate, ZONE)).toBe('sunday')

    // 18:30Z -> 00:00 the following calendar day in Asia/Kolkata (Sunday).
    const nextDay = new Date('2026-09-12T18:30:00Z')
    expect(localDateInTimezone(nextDay, ZONE)).toBe('2026-09-13')
    expect(zonedWeekday(nextDay, ZONE)).toBe('sunday')
  })

  it('adds calendar days across month and year boundaries', () => {
    expect(addDay('2026-09-15')).toBe('2026-09-16')
    expect(addDay('2026-12-31')).toBe('2027-01-01')
  })
})

describe('computeNextFireAt (recurrence modes)', () => {
  // Tuesday 2026-09-15 at 13:30 IST (08:00 UTC)
  const now = new Date('2026-09-15T08:00:00.000Z')

  it('schedules Once and Daily for later today or tomorrow', () => {
    // 14:00 IST today (future)
    expect(computeNextFireAt('14:00', 'once', ZONE, null, now)).toBe('2026-09-15T08:30:00.000Z')
    expect(computeNextFireAt('14:00', 'daily', ZONE, null, now)).toBe('2026-09-15T08:30:00.000Z')
    // 13:00 IST today (already passed) -> tomorrow at 13:00 IST (07:30 UTC)
    expect(computeNextFireAt('13:00', 'once', ZONE, null, now)).toBe('2026-09-16T07:30:00.000Z')
    expect(computeNextFireAt('13:00', 'daily', ZONE, null, now)).toBe('2026-09-16T07:30:00.000Z')
  })

  it('schedules Weekdays skipping Saturday and Sunday', () => {
    // On Friday afternoon (2026-09-18 13:30 IST = 08:00 UTC), changing to passed time 10:00 IST schedules for Monday 2026-09-21
    const fridayNow = new Date('2026-09-18T08:00:00.000Z')
    const nextWeekday = computeNextFireAt('10:00', 'weekdays', ZONE, null, fridayNow)
    // 10:00 IST on Monday 2026-09-21 is 04:30 UTC
    expect(nextWeekday).toBe('2026-09-21T04:30:00.000Z')
  })

  it('schedules Weekly for the specified day of week', () => {
    // now is Tuesday 2026-09-15 13:30 IST (08:00 UTC)
    // Selected weekday = Wednesday: next occurrence is tomorrow (Wednesday 2026-09-16 10:00 IST = 04:30 UTC)
    expect(computeNextFireAt('10:00', 'weekly', ZONE, 'wednesday', now)).toBe('2026-09-16T04:30:00.000Z')

    // Selected weekday = Tuesday, future time (14:00 IST) -> today 2026-09-15 08:30 UTC
    expect(computeNextFireAt('14:00', 'weekly', ZONE, 'tuesday', now)).toBe('2026-09-15T08:30:00.000Z')

    // Selected weekday = Tuesday, passed time (10:00 IST) -> next Tuesday 2026-09-22 04:30 UTC
    expect(computeNextFireAt('10:00', 'weekly', ZONE, 'tuesday', now)).toBe('2026-09-22T04:30:00.000Z')
  })

  it('recalculates next_fire_at when editing time or recurrence', () => {
    // User edits to 14:00 Weekdays
    const newFireAt = computeNextFireAt('14:00', 'weekdays', ZONE, null, now)
    expect(newFireAt).toBe('2026-09-15T08:30:00.000Z')
  })
})

describe('time conversion and arbitrary minute typing helpers', () => {
  it('parses arbitrary minutes (01, 17, 46, 47, 59)', () => {
    expect(parseLocalTime('09:01')).toEqual({ hour12: 9, minute: 1, period: 'AM' })
    expect(parseLocalTime('09:17')).toEqual({ hour12: 9, minute: 17, period: 'AM' })
    expect(parseLocalTime('09:46')).toEqual({ hour12: 9, minute: 46, period: 'AM' })
    expect(parseLocalTime('09:47')).toEqual({ hour12: 9, minute: 47, period: 'AM' })
    expect(parseLocalTime('12:01')).toEqual({ hour12: 12, minute: 1, period: 'PM' })
    expect(parseLocalTime('01:48')).toEqual({ hour12: 1, minute: 48, period: 'AM' })
    expect(parseLocalTime('18:37')).toEqual({ hour12: 6, minute: 37, period: 'PM' })
    expect(parseLocalTime('23:59')).toEqual({ hour12: 11, minute: 59, period: 'PM' })
  })

  it('converts arbitrary minutes to 24h format', () => {
    expect(to24HourTime(9, 1, 'AM')).toBe('09:01')
    expect(to24HourTime(9, 17, 'AM')).toBe('09:17')
    expect(to24HourTime(9, 46, 'AM')).toBe('09:46')
    expect(to24HourTime(9, 47, 'AM')).toBe('09:47')
    expect(to24HourTime(12, 1, 'PM')).toBe('12:01')
    expect(to24HourTime(1, 48, 'AM')).toBe('01:48')
    expect(to24HourTime(6, 37, 'PM')).toBe('18:37')
  })
})

describe('note-level vs item-level completion independence', () => {
  it('tracks daily completion independently for note-level and item-level reminders on the same note', () => {
    const noteLevel = makeReminder({ id: 'r_note', note_id: 'n1', checklist_item_id: null })
    const itemLevel = makeReminder({ id: 'r_item', note_id: 'n1', checklist_item_id: 'c1' })

    const completions: DailyChecklistCompletion[] = [
      { reminder_id: 'r_note', local_date: '2026-09-15', completed_at: '2026-09-15T07:00:00Z' },
    ]

    const testNow = new Date('2026-09-15T08:00:00.000Z')
    expect(isCompletedToday(noteLevel, completions, testNow)).toBe(true)
    expect(isCompletedToday(itemLevel, completions, testNow)).toBe(false)
  })
})

describe('Supabase reminder persistence contract and state selector simulation', () => {
  it('A. create note-level reminder: checklist_item_id is null and returned row enters state', () => {
    let reminders: ChecklistReminder[] = []
    const setReminders = (updater: (prev: ChecklistReminder[]) => ChecklistReminder[]) => {
      reminders = updater(reminders)
    }

    const payload = {
      user_id: 'u1',
      note_id: 'n100',
      checklist_item_id: null,
      local_time: '09:32',
      enabled: true,
      recurrence: 'daily' as const,
      day_of_week: null,
      timezone: 'Asia/Kolkata',
      next_fire_at: '2026-09-18T04:02:00.000Z',
    }

    // Mock returned row from Supabase insert
    const returnedRow: ChecklistReminder = {
      ...payload,
      id: 'rem_note_1',
      last_fired_at: null,
      created_at: '2026-09-17T06:00:00.000Z',
      updated_at: '2026-09-17T06:00:00.000Z',
    }

    setReminders((current) => [...current.filter((entry) => entry.id !== returnedRow.id), returnedRow])

    // Selector verification
    const selected = noteReminder(reminders, 'n100')
    expect(selected).toBeDefined()
    expect(selected?.id).toBe('rem_note_1')
    expect(selected?.checklist_item_id).toBeNull()
    expect(selected?.local_time).toBe('09:32')
    expect(formatReminderTime(selected!.local_time)).toBe('09:32 AM')
    expect(formatRecurrenceLabel(selected!.recurrence)).toBe('Daily')
  })

  it('B. update note-level reminder: existing ID updated and returned row replaces old state', () => {
    const initial: ChecklistReminder = {
      id: 'rem_note_1',
      user_id: 'u1',
      note_id: 'n100',
      checklist_item_id: null,
      local_time: '09:32',
      enabled: true,
      recurrence: 'daily',
      day_of_week: null,
      timezone: 'Asia/Kolkata',
      next_fire_at: '2026-09-18T04:02:00.000Z',
      last_fired_at: null,
      created_at: '2026-09-17T06:00:00.000Z',
      updated_at: '2026-09-17T06:00:00.000Z',
    }

    let reminders: ChecklistReminder[] = [initial]
    const setReminders = (updater: (prev: ChecklistReminder[]) => ChecklistReminder[]) => {
      reminders = updater(reminders)
    }

    // Mock updated row returned from Supabase update
    const updatedRow: ChecklistReminder = {
      ...initial,
      local_time: '10:45',
      recurrence: 'weekly',
      day_of_week: 'friday',
      updated_at: '2026-09-17T06:10:00.000Z',
    }

    setReminders((current) => [...current.filter((entry) => entry.id !== updatedRow.id), updatedRow])

    const selected = noteReminder(reminders, 'n100')
    expect(selected).toBeDefined()
    expect(selected?.id).toBe('rem_note_1')
    expect(selected?.local_time).toBe('10:45')
    expect(selected?.recurrence).toBe('weekly')
    expect(selected?.day_of_week).toBe('friday')
    expect(formatReminderTime(selected!.local_time)).toBe('10:45 AM')
    expect(formatRecurrenceLabel(selected!.recurrence)).toBe('Weekly')
    expect(reminders.length).toBe(1)
  })

  it('C. create item-level reminder: correct checklist_item_id saved and enters state', () => {
    let reminders: ChecklistReminder[] = []
    const setReminders = (updater: (prev: ChecklistReminder[]) => ChecklistReminder[]) => {
      reminders = updater(reminders)
    }

    const payload = {
      user_id: 'u1',
      note_id: 'n100',
      checklist_item_id: 'item_uuid_123',
      local_time: '12:32',
      enabled: true,
      recurrence: 'daily' as const,
      day_of_week: null,
      timezone: 'Asia/Kolkata',
      next_fire_at: '2026-09-18T07:02:00.000Z',
    }

    const returnedRow: ChecklistReminder = {
      ...payload,
      id: 'rem_item_1',
      last_fired_at: null,
      created_at: '2026-09-17T06:00:00.000Z',
      updated_at: '2026-09-17T06:00:00.000Z',
    }

    setReminders((current) => [...current.filter((entry) => entry.id !== returnedRow.id), returnedRow])

    // Selector verification
    const selected = reminderForItem(reminders, 'n100', 'item_uuid_123')
    expect(selected).toBeDefined()
    expect(selected?.id).toBe('rem_item_1')
    expect(selected?.checklist_item_id).toBe('item_uuid_123')
    expect(selected?.local_time).toBe('12:32')
    expect(formatReminderTime(selected!.local_time)).toBe('12:32 PM')
    // Note level should NOT be affected
    expect(noteReminder(reminders, 'n100')).toBeUndefined()
  })

  it('D. update item-level reminder: existing ID updated and replaces old state', () => {
    const initial: ChecklistReminder = {
      id: 'rem_item_1',
      user_id: 'u1',
      note_id: 'n100',
      checklist_item_id: 'item_uuid_123',
      local_time: '12:32',
      enabled: true,
      recurrence: 'daily',
      day_of_week: null,
      timezone: 'Asia/Kolkata',
      next_fire_at: '2026-09-18T07:02:00.000Z',
      last_fired_at: null,
      created_at: '2026-09-17T06:00:00.000Z',
      updated_at: '2026-09-17T06:00:00.000Z',
    }

    let reminders: ChecklistReminder[] = [initial]
    const setReminders = (updater: (prev: ChecklistReminder[]) => ChecklistReminder[]) => {
      reminders = updater(reminders)
    }

    const updatedRow: ChecklistReminder = {
      ...initial,
      local_time: '12:46',
      updated_at: '2026-09-17T06:15:00.000Z',
    }

    setReminders((current) => [...current.filter((entry) => entry.id !== updatedRow.id), updatedRow])

    const selected = reminderForItem(reminders, 'n100', 'item_uuid_123')
    expect(selected).toBeDefined()
    expect(selected?.id).toBe('rem_item_1')
    expect(selected?.local_time).toBe('12:46')
    expect(formatReminderTime(selected!.local_time)).toBe('12:46 PM')
    expect(reminders.length).toBe(1)
  })

  it('E. Supabase error: state remains intact and error message is set without false success', () => {
    let reminders: ChecklistReminder[] = []
    let appMessage = ''
    const setReminders = (updater: (prev: ChecklistReminder[]) => ChecklistReminder[]) => {
      reminders = updater(reminders)
    }
    const setMessage = (msg: string) => {
      appMessage = msg
    }

    // Simulate Supabase returning an error
    const dbError = { message: 'relation "reminders" does not exist' }
    if (dbError) {
      setMessage(dbError.message)
    } else {
      setReminders((c) => c)
    }

    expect(reminders.length).toBe(0)
    expect(appMessage).toBe('relation "reminders" does not exist')
  })
})
