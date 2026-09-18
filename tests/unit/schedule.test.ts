import { describe, expect, it } from 'vitest'
import {
  addDay,
  buildNotificationContent,
  formatWebPushSubscription,
  hasCompletionOnDate,
  isReminderValid,
  isSubscriptionGone,
  isValidReminderTime,
  isValidTimezone,
  nextFireAt,
  nextFireAtForRecurrence,
  normalizeNote,
  preflightReminder,
  zonedDateStr,
  zonedWallClockToUtc,
} from '../../supabase/functions/send-reminders/schedule'

const KOLKATA = 'Asia/Kolkata' // UTC+5:30, fixed offset (no DST)
const NEW_YORK = 'America/New_York' // DST zone

function reminder(overrides: Partial<Parameters<typeof nextFireAt>[0]> = {}) {
  return {
    local_time: '09:00',
    timezone: KOLKATA,
    next_fire_at: null,
    ...overrides,
  }
}

describe('addDay', () => {
  it('adds a calendar day across month and year boundaries', () => {
    expect(addDay('2026-09-13')).toBe('2026-09-14')
    expect(addDay('2026-12-31')).toBe('2027-01-01')
    expect(addDay('2026-02-28')).toBe('2026-03-01')
  })
})

describe('zonedDateStr', () => {
  it('returns the local calendar date in the given zone', () => {
    expect(zonedDateStr(new Date('2026-09-13T03:30:00Z'), KOLKATA)).toBe('2026-09-13')
    expect(zonedDateStr(new Date('2026-09-12T18:30:00Z'), KOLKATA)).toBe('2026-09-13')
  })
})

describe('zonedWallClockToUtc', () => {
  it('handles a fixed-offset zone (Asia/Kolkata)', () => {
    expect(zonedWallClockToUtc('2026-09-13', '09:00', KOLKATA).toISOString()).toBe('2026-09-13T03:30:00.000Z')
  })

  it('handles America/New_York DST spring-forward (UTC-5 -> UTC-4)', () => {
    // Day before DST start: 09:00 local = 14:00 UTC (EST, UTC-5).
    expect(zonedWallClockToUtc('2026-03-07', '09:00', NEW_YORK).toISOString()).toBe('2026-03-07T14:00:00.000Z')
    // DST start day (2026-03-08): 09:00 local = 13:00 UTC (EDT, UTC-4).
    expect(zonedWallClockToUtc('2026-03-08', '09:00', NEW_YORK).toISOString()).toBe('2026-03-08T13:00:00.000Z')
  })

  it('handles America/New_York DST fall-back (UTC-4 -> UTC-5)', () => {
    // Day before DST ends: 09:00 local = 13:00 UTC (EDT, UTC-4).
    expect(zonedWallClockToUtc('2026-10-31', '09:00', NEW_YORK).toISOString()).toBe('2026-10-31T13:00:00.000Z')
    // DST end day (2026-11-01): 09:00 local = 14:00 UTC (EST, UTC-5).
    expect(zonedWallClockToUtc('2026-11-01', '09:00', NEW_YORK).toISOString()).toBe('2026-11-01T14:00:00.000Z')
  })
})

describe('nextFireAt', () => {
  it('schedules within the same local day when run before the daily time', () => {
    const now = new Date('2026-09-13T03:00:00Z') // 08:30 in Kolkata
    expect(nextFireAt(reminder(), now)).toBe('2026-09-13T03:30:00.000Z')
  })

  it('advances a daily occurrence from one local date to the next once the time has passed', () => {
    const now = new Date('2026-09-13T03:31:00Z') // 09:01 in Kolkata - today already passed
    expect(nextFireAt(reminder(), now)).toBe('2026-09-14T03:30:00.000Z')
  })

  it('a slightly-late cron run does not skip the due occurrence', () => {
    // Scheduled for 09:00 IST today; cron arrives 15 minutes late.
    const late = reminder({ next_fire_at: '2026-09-13T03:30:00.000Z' })
    const now = new Date('2026-09-13T03:45:00Z')
    expect(nextFireAt(late, now)).toBe('2026-09-14T03:30:00.000Z')
  })

  it('respects DST spring-forward offset change when advancing', () => {
    const now = new Date('2026-03-08T12:59:00Z') // 08:59 EDT on the DST start day
    expect(nextFireAt(reminder({ timezone: NEW_YORK }), now)).toBe('2026-03-08T13:00:00.000Z')
  })

  it('respects DST fall-back offset change when advancing', () => {
    const now = new Date('2026-11-01T13:59:00Z') // 08:59 EST on the DST end day
    expect(nextFireAt(reminder({ timezone: NEW_YORK }), now)).toBe('2026-11-01T14:00:00.000Z')
  })
})

describe('nextFireAtForRecurrence', () => {
  it('once recurrence returns null so reminder becomes inactive', () => {
    const r = reminder({ recurrence: 'once', next_fire_at: '2026-09-15T03:30:00.000Z' })
    expect(nextFireAtForRecurrence(r)).toBeNull()
  })

  it('daily recurrence advances one day', () => {
    const r = reminder({ recurrence: 'daily', next_fire_at: '2026-09-15T03:30:00.000Z' })
    expect(nextFireAtForRecurrence(r)).toBe('2026-09-16T03:30:00.000Z')
  })

  it('weekdays recurrence advances to next weekday skipping weekends', () => {
    // Friday occurrence: 2026-09-18 at 09:00 IST (03:30 UTC)
    const fridayReminder = reminder({ recurrence: 'weekdays', next_fire_at: '2026-09-18T03:30:00.000Z' })
    // Next occurrence must be Monday 2026-09-21 at 09:00 IST (03:30 UTC)
    expect(nextFireAtForRecurrence(fridayReminder)).toBe('2026-09-21T03:30:00.000Z')
  })

  it('weekly recurrence advances exactly 7 days preserving weekday', () => {
    // Wednesday occurrence: 2026-09-16 at 09:00 IST (03:30 UTC)
    const wednesdayReminder = reminder({ recurrence: 'weekly', next_fire_at: '2026-09-16T03:30:00.000Z' })
    // Next occurrence must be Wednesday 2026-09-23 at 09:00 IST (03:30 UTC)
    expect(nextFireAtForRecurrence(wednesdayReminder)).toBe('2026-09-23T03:30:00.000Z')
  })

  it('weekly recurrence schedules on the stored day_of_week when there is no prior fire date', () => {
    // Now is Tuesday 2026-09-15 09:00 IST (03:30 UTC), stored day = Thursday.
    const now = new Date('2026-09-15T03:30:00.000Z')
    const fresh = reminder({ recurrence: 'weekly', day_of_week: 'thursday', next_fire_at: null })
    // First occurrence must be Thursday 2026-09-17 at 09:00 IST (03:30 UTC), never the weekday of "now".
    expect(nextFireAtForRecurrence(fresh, now)).toBe('2026-09-17T03:30:00.000Z')
  })
})

describe('hasCompletionOnDate', () => {
  it('an already-completed-today reminder must not produce another notification', () => {
    const completions = [
      { reminder_id: 'r1', local_date: '2026-09-13' },
      { reminder_id: 'r2', local_date: '2026-09-13' },
      { reminder_id: 'r1', local_date: '2026-09-12' },
    ]
    expect(hasCompletionOnDate(completions, 'r1', '2026-09-13')).toBe(true)
    expect(hasCompletionOnDate(completions, 'r1', '2026-09-14')).toBe(false)
    expect(hasCompletionOnDate(completions, 'r9', '2026-09-13')).toBe(false)
  })
})

describe('normalizeNote', () => {
  const note = { deleted_at: null, checklist: [{ id: 'c1', text: 'Do something' }] }

  it('returns the note directly when PostgREST returns a plain object (many-to-one)', () => {
    expect(normalizeNote(note)).toBe(note)
  })

  it('returns the first element when PostgREST returns a single-element array', () => {
    const result = normalizeNote([note])
    expect(result).toBe(note)
  })

  it('returns undefined for null (note hard-deleted / FK cascade)', () => {
    expect(normalizeNote(null)).toBeUndefined()
  })

  it('returns undefined for undefined (no embedded relation)', () => {
    expect(normalizeNote(undefined)).toBeUndefined()
  })

  it('returns undefined for an empty array (no matching note)', () => {
    expect(normalizeNote([])).toBeUndefined()
  })
})

describe('formatWebPushSubscription', () => {
  it('transforms a database push subscription row to the nested web-push structure', () => {
    const row = {
      id: 'sub_123',
      endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/abc',
      p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9AcUbVlJx6',
      auth: 'tBHItJI5svbpez7KI4CCXg',
    }
    const formatted = formatWebPushSubscription(row)
    expect(formatted).toEqual({
      endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/abc',
      keys: {
        p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9AcUbVlJx6',
        auth: 'tBHItJI5svbpez7KI4CCXg',
      },
    })
  })
})

describe('isSubscriptionGone', () => {
  it('returns true for 404 Not Found and 410 Gone', () => {
    expect(isSubscriptionGone(404)).toBe(true)
    expect(isSubscriptionGone(410)).toBe(true)
  })

  it('returns false for other status codes or undefined', () => {
    expect(isSubscriptionGone(200)).toBe(false)
    expect(isSubscriptionGone(400)).toBe(false)
    expect(isSubscriptionGone(401)).toBe(false)
    expect(isSubscriptionGone(500)).toBe(false)
    expect(isSubscriptionGone(undefined)).toBe(false)
    expect(isSubscriptionGone(null)).toBe(false)
  })
})

describe('isReminderValid', () => {
  const activeNote = {
    title: 'Grocery List',
    deleted_at: null,
    checklist: [{ id: 'c1', text: 'Buy milk', done: false }],
  }

  it('validates a note-level reminder when note is active (even without checklist items)', () => {
    expect(isReminderValid({ checklist_item_id: null }, activeNote)).toBe(true)
    expect(isReminderValid({ checklist_item_id: null }, { title: 'Empty note', deleted_at: null, checklist: [] })).toBe(true)
    expect(isReminderValid({ checklist_item_id: null }, { title: 'No checklist field', deleted_at: null })).toBe(true)
  })

  it('invalidates a note-level reminder when note is soft-deleted or missing', () => {
    expect(isReminderValid({ checklist_item_id: null }, { ...activeNote, deleted_at: '2026-09-15T00:00:00Z' })).toBe(false)
    expect(isReminderValid({ checklist_item_id: null }, undefined)).toBe(false)
  })

  it('validates an item-level reminder when checklist item exists', () => {
    expect(isReminderValid({ checklist_item_id: 'c1' }, activeNote)).toBe(true)
  })

  it('invalidates an item-level reminder when checklist item is removed or note is deleted', () => {
    expect(isReminderValid({ checklist_item_id: 'c2' }, activeNote)).toBe(false)
    expect(isReminderValid({ checklist_item_id: 'c1' }, { ...activeNote, deleted_at: '2026-09-15T00:00:00Z' })).toBe(false)
    expect(isReminderValid({ checklist_item_id: 'c1' }, undefined)).toBe(false)
  })
})

describe('isValidTimezone', () => {
  it('accepts usable IANA zones and rejects invalid/empty ones without throwing', () => {
    expect(isValidTimezone(KOLKATA)).toBe(true)
    expect(isValidTimezone(NEW_YORK)).toBe(true)
    expect(isValidTimezone('UTC')).toBe(true)
    expect(isValidTimezone('Mars/Olympus')).toBe(false)
    expect(isValidTimezone('')).toBe(false)
    expect(isValidTimezone(undefined)).toBe(false)
  })
})

describe('isValidReminderTime', () => {
  it('accepts HH:MM and the HH:MM:SS form returned by Postgres time columns', () => {
    expect(isValidReminderTime('09:00')).toBe(true)
    expect(isValidReminderTime('09:47')).toBe(true)
    expect(isValidReminderTime('23:59')).toBe(true)
    expect(isValidReminderTime('00:00')).toBe(true)
    expect(isValidReminderTime('09:00:00')).toBe(true)
    expect(isValidReminderTime('9:00')).toBe(false)
    expect(isValidReminderTime('24:00')).toBe(false)
    expect(isValidReminderTime('noon')).toBe(false)
    expect(isValidReminderTime(undefined)).toBe(false)
  })
})

describe('preflightReminder', () => {
  const base = {
    checklist_item_id: 'c1' as string | null,
    local_time: '09:00',
    timezone: KOLKATA,
    next_fire_at: null as string | null,
    notes: {
      title: 'Grocery List',
      deleted_at: null as string | null,
      checklist: [{ id: 'c1', text: 'Buy milk', done: false }],
    },
  }

  function reasonFor(reminder: Parameters<typeof preflightReminder>[0]): string | null {
    const result = preflightReminder(reminder)
    return result.ok ? null : result.reason
  }

  it('accepts a valid active reminder and returns the normalized note', () => {
    const result = preflightReminder(base)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.note.title).toBe('Grocery List')
    }
  })

  it('accepts a valid note-level reminder without a checklist', () => {
    const noteLevel = { ...base, checklist_item_id: null, notes: { title: 'Ideas', deleted_at: null } }
    const result = preflightReminder(noteLevel)
    expect(result.ok).toBe(true)
  })

  it('rejects a missing note, a soft-deleted note, and a removed checklist item', () => {
    expect(reasonFor({ ...base, notes: undefined })).toBe('invalid-reminder')
    expect(reasonFor({ ...base, notes: { ...base.notes, deleted_at: '2026-09-15T00:00:00Z' } })).toBe('invalid-reminder')
    expect(reasonFor({ ...base, checklist_item_id: 'c2' })).toBe('invalid-reminder')
  })

  it('rejects a malformed note/checklist shape that would otherwise crash content generation', () => {
    expect(reasonFor({ ...base, notes: { title: 'x', deleted_at: null, checklist: {} as unknown as typeof base.notes.checklist } }))
      .toBe('malformed-note')
    expect(reasonFor({ ...base, notes: { title: 'x', deleted_at: null, checklist: [null] as unknown as typeof base.notes.checklist } }))
      .toBe('malformed-note')
  })

  it('rejects invalid recurrence, local_time, timezone, next_fire_at, and weekly weekday', () => {
    expect(reasonFor({ ...base, recurrence: 'hourly' as never })).toBe('invalid-recurrence')
    expect(reasonFor({ ...base, local_time: 'noon' })).toBe('invalid-local-time')
    expect(reasonFor({ ...base, timezone: 'Mars/Olympus' })).toBe('invalid-timezone')
    expect(reasonFor({ ...base, next_fire_at: 'not-a-date' })).toBe('invalid-next-fire-at')
    expect(reasonFor({ ...base, next_fire_at: null })).toBe(null)
    expect(reasonFor({ ...base, recurrence: 'weekly', day_of_week: 'funday' as never })).toBe('invalid-weekday')
    expect(reasonFor({ ...base, recurrence: 'weekly', day_of_week: 'monday' as never })).toBe(null)
  })

  it('accepts the HH:MM:SS local_time form returned by Postgres', () => {
    expect(reasonFor({ ...base, local_time: '09:00:00' })).toBe(null)
  })
})

describe('buildNotificationContent', () => {
  it('builds note-level reminder notification with task counts', () => {
    const note = {
      title: 'Trip Prep',
      deleted_at: null,
      checklist: [
        { id: 'c1', text: 'Pack bag', done: false },
        { id: 'c2', text: 'Book cab', done: false },
        { id: 'c3', text: 'Charged powerbank', done: true },
      ],
    }
    const result = buildNotificationContent({ checklist_item_id: null }, note)
    expect(result.title).toBe('Trip Prep')
    expect(result.body).toBe('2 checklist tasks remaining.')
  })

  it('builds note-level reminder notification with single remaining task', () => {
    const note = {
      title: 'Workout',
      deleted_at: null,
      checklist: [{ id: 'c1', text: 'Leg day', done: false }],
    }
    const result = buildNotificationContent({ checklist_item_id: null }, note)
    expect(result.title).toBe('Workout')
    expect(result.body).toBe('1 checklist task remaining.')
  })

  it('builds note-level reminder notification when all tasks done or empty checklist', () => {
    const note = {
      title: 'Ideas',
      deleted_at: null,
      checklist: [],
    }
    const result = buildNotificationContent({ checklist_item_id: null }, note)
    expect(result.title).toBe('Ideas')
    expect(result.body).toBe('No checklist tasks remaining.')
  })

  it('builds note-level reminder notification with fallback title when title is empty', () => {
    const note = {
      title: '',
      deleted_at: null,
      checklist: [],
    }
    const result = buildNotificationContent({ checklist_item_id: null }, note)
    expect(result.title).toBe("Raj's Vault")
    expect(result.body).toBe('No checklist tasks remaining.')
  })

  it('builds item-level reminder notification with item text as title', () => {
    const note = {
      title: 'Trip Prep',
      deleted_at: null,
      checklist: [{ id: 'c1', text: 'Belt', done: false }],
    }
    const result = buildNotificationContent({ checklist_item_id: 'c1' }, note)
    expect(result.title).toBe('Belt')
    expect(result.body).toBe('From \u201cTrip Prep\u201d \u00b7 1 task remaining.')
  })

  it('builds item-level reminder notification when no tasks remain', () => {
    const note = {
      title: 'Daily Checklist',
      deleted_at: null,
      checklist: [{ id: 'c1', text: 'Belt', done: true }],
    }
    const result = buildNotificationContent({ checklist_item_id: 'c1' }, note)
    expect(result.title).toBe('Belt')
    expect(result.body).toBe('From \u201cDaily Checklist\u201d \u00b7 No tasks remaining.')
  })

  it('builds item-level reminder notification when a single task remains', () => {
    const note = {
      title: 'Trip Prep',
      deleted_at: null,
      checklist: [
        { id: 'c1', text: 'Book hotel', done: false },
        { id: 'c2', text: 'Pack bag', done: true },
      ],
    }
    const result = buildNotificationContent({ checklist_item_id: 'c1' }, note)
    expect(result.title).toBe('Book hotel')
    expect(result.body).toBe('From \u201cTrip Prep\u201d \u00b7 1 task remaining.')
  })

  it('builds item-level reminder notification when multiple tasks remain', () => {
    const note = {
      title: 'Daily Checklist',
      deleted_at: null,
      checklist: [
        { id: 'c1', text: 'Belt', done: false },
        { id: 'c2', text: 'Book hotel', done: false },
        { id: 'c3', text: 'Pack bag', done: false },
        { id: 'c4', text: 'Charged powerbank', done: false },
        { id: 'c5', text: 'Leg day', done: false },
      ],
    }
    const result = buildNotificationContent({ checklist_item_id: 'c1' }, note)
    expect(result.title).toBe('Belt')
    expect(result.body).toBe('From \u201cDaily Checklist\u201d \u00b7 5 tasks remaining.')
  })
})
