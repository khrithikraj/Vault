import type { ChecklistReminder, DailyChecklistCompletion, Weekday } from '../types/app'

export type ReminderRecurrence = 'once' | 'daily' | 'weekdays' | 'weekly'

export const WEEKDAYS: Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

export const WEEKDAY_TO_NUMBER: Record<Weekday, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}

export const NUMBER_TO_WEEKDAY: Record<number, Weekday> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
}

export function formatWeekdayLabel(day: Weekday): string {
  switch (day) {
    case 'monday': return 'Monday'
    case 'tuesday': return 'Tuesday'
    case 'wednesday': return 'Wednesday'
    case 'thursday': return 'Thursday'
    case 'friday': return 'Friday'
    case 'saturday': return 'Saturday'
    case 'sunday': return 'Sunday'
  }
}

export function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

/** Adds one calendar day to a "YYYY-MM-DD" string (month/year boundaries safe). */
export function addDay(localDate: string): string {
  const [year, month, day] = localDate.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + 1))
  return next.toISOString().slice(0, 10)
}

/** "YYYY-MM-DD" date (in the given zone) for a UTC instant. */
export function zonedDateStr(instant: Date, zone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant)
}

export function localDateInTimezone(date: Date, timezone: string): string {
  return zonedDateStr(date, timezone)
}

/** Day-of-week (0=Sun … 6=Sat) for a "YYYY-MM-DD" local date string. */
export function zonedDayOfWeek(localDate: string, zone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    weekday: 'short',
  }).formatToParts(new Date(`${localDate}T12:00:00Z`))
  const dayStr = parts.find((p) => p.type === 'weekday')?.value ?? ''
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return map[dayStr] ?? 0
}

/** Returns the Weekday name ('monday'..'sunday') for a date in the given timezone. */
export function zonedWeekday(date: Date, zone: string): Weekday {
  const dateStr = zonedDateStr(date, zone)
  const num = zonedDayOfWeek(dateStr, zone)
  return NUMBER_TO_WEEKDAY[num] ?? 'monday'
}

/** Converts a naive local wall-clock time ("YYYY-MM-DD" + "HH:MM") in an IANA
 * zone into the real UTC instant it refers to (DST- and offset-aware). */
export function zonedWallClockToUtc(localDate: string, localTime: string, zone: string): Date {
  const target = Date.parse(`${localDate}T${localTime}:00Z`)
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  let instant = target
  for (let i = 0; i < 4; i++) {
    const parts = Object.fromEntries(
      fmt.formatToParts(new Date(instant)).map((part) => [part.type, part.value]),
    )
    const rendered = Date.parse(
      `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`,
    )
    instant += target - rendered
  }
  return new Date(instant)
}

/** Strict, allocation-free "YYYY-MM-DD" parser. Returns null for anything that is
 *  not a real calendar date (so "2026-02-30" and "2026-13-01" are rejected).
 *  Deliberately never constructs a `Date` from the string: a bare
 *  `new Date('2026-10-14')` is parsed as UTC midnight and silently shifts a day
 *  for anyone west of Greenwich. */
export function parseFireOnDate(value: string | null | undefined): { year: number; month: number; day: number } | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  // Round-trip through a UTC calendar date to reject overflow days like 2026-02-30.
  const probe = new Date(Date.UTC(year, month - 1, day))
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return null
  }
  return { year, month, day }
}

/** True when `value` is a usable "YYYY-MM-DD" calendar date. */
export function isValidFireOnDate(value: string | null | undefined): boolean {
  return parseFireOnDate(value) !== null
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** Renders a "YYYY-MM-DD" fire date as "14 Oct 2026" for display. Pure string
 *  handling — no `Date`, so the shown day can never drift from the stored day.
 *  Single-digit days stay unpadded, matching `formatReminderTime`. */
export function formatReminderDate(value: string | null | undefined): string {
  const parsed = parseFireOnDate(value)
  if (!parsed) return ''
  return `${parsed.day} ${MONTH_NAMES[parsed.month - 1].slice(0, 3)} ${parsed.year}`
}

export type ReminderScheduleInput = {
  localTime: string
  recurrence: ReminderRecurrence
  timezone?: string | null
  dayOfWeek?: Weekday | null
  /** Exact calendar date for a 'once' reminder ("YYYY-MM-DD"). Ignored otherwise. */
  fireOnDate?: string | null
  now?: Date
}

/**
 * Recurrence-aware next_fire_at calculation. The single source of truth for
 * client scheduling.
 *
 * `once`     → the EXACT instant for `fireOnDate` + `localTime` in the reminder
 *               timezone, never advanced. With no `fireOnDate` (legacy rows) it
 *               falls back to the first future occurrence today or tomorrow.
 * `daily`    → first future occurrence today/tomorrow.
 * `weekdays` → first future Mon–Fri occurrence.
 * `weekly`   → first future occurrence on the specified `dayOfWeek` (or today's
 *               weekday if omitted).
 */
export function resolveNextFireAt(input: ReminderScheduleInput): string {
  const { recurrence, dayOfWeek, fireOnDate } = input
  const now = input.now ?? new Date()
  const zone = input.timezone || browserTimezone()
  const time = input.localTime.slice(0, 5)

  if (recurrence === 'once') {
    // An explicit date means the user chose this exact calendar day, so the
    // occurrence is derived straight from it. `zonedWallClockToUtc` reads the
    // date as a wall-clock value IN the reminder's timezone, which is what keeps
    // the UTC instant correct instead of being shifted by the machine's own zone.
    if (isValidFireOnDate(fireOnDate)) {
      return zonedWallClockToUtc(fireOnDate as string, time, zone).toISOString()
    }

    let localDate = zonedDateStr(now, zone)
    let candidate = zonedWallClockToUtc(localDate, time, zone)
    if (candidate.getTime() <= now.getTime()) {
      localDate = addDay(localDate)
      candidate = zonedWallClockToUtc(localDate, time, zone)
    }
    return candidate.toISOString()
  }

  if (recurrence === 'daily') {
    let localDate = zonedDateStr(now, zone)
    let candidate = zonedWallClockToUtc(localDate, time, zone)
    if (candidate.getTime() <= now.getTime()) {
      localDate = addDay(localDate)
      candidate = zonedWallClockToUtc(localDate, time, zone)
    }
    return candidate.toISOString()
  }

  if (recurrence === 'weekdays') {
    let localDate = zonedDateStr(now, zone)
    for (let i = 0; i < 14; i++) {
      const dow = zonedDayOfWeek(localDate, zone)
      if (dow >= 1 && dow <= 5) {
        const candidate = zonedWallClockToUtc(localDate, time, zone)
        if (candidate.getTime() > now.getTime()) return candidate.toISOString()
      }
      localDate = addDay(localDate)
    }
    return zonedWallClockToUtc(localDate, time, zone).toISOString()
  }

  if (recurrence === 'weekly') {
    const targetDow = dayOfWeek
      ? WEEKDAY_TO_NUMBER[dayOfWeek]
      : zonedDayOfWeek(zonedDateStr(now, zone), zone)

    let localDate = zonedDateStr(now, zone)
    for (let i = 0; i < 14; i++) {
      if (zonedDayOfWeek(localDate, zone) === targetDow) {
        const candidate = zonedWallClockToUtc(localDate, time, zone)
        if (candidate.getTime() > now.getTime()) return candidate.toISOString()
      }
      localDate = addDay(localDate)
    }
    return zonedWallClockToUtc(localDate, time, zone).toISOString()
  }

  // Fallback (daily)
  let localDate = zonedDateStr(now, zone)
  let candidate = zonedWallClockToUtc(localDate, time, zone)
  if (candidate.getTime() <= now.getTime()) {
    localDate = addDay(localDate)
    candidate = zonedWallClockToUtc(localDate, time, zone)
  }
  return candidate.toISOString()
}

/**
 * Recurrence-aware initial or updated next_fire_at calculation (client-side).
 *
 * Positional wrapper over {@link resolveNextFireAt}, kept for the existing call
 * sites. `fireOnDate` is last so the historical `(localTime, recurrence, timezone,
 * dayOfWeek, now)` argument order stays valid.
 *
 * Always returns strictly after `now` for every REPEATING mode. A 'once'
 * reminder that carries an explicit `fireOnDate` is the one exception: it
 * returns that exact instant verbatim, because silently rolling a chosen date
 * forward to tomorrow is precisely the behaviour the date picker exists to stop.
 */
export function computeNextFireAt(
  localTime: string,
  recurrence: ReminderRecurrence,
  timezone: string,
  dayOfWeek?: Weekday | null,
  now = new Date(),
  fireOnDate?: string | null,
): string {
  return resolveNextFireAt({ localTime, recurrence, timezone, dayOfWeek, now, fireOnDate })
}

export function isCompletedToday(
  reminder: ChecklistReminder,
  completions: DailyChecklistCompletion[],
  now = new Date(),
): boolean {
  const today = localDateInTimezone(now, reminder.timezone)
  return completions.some((completion) => completion.reminder_id === reminder.id && completion.local_date === today)
}

export function validateReminderTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

/** Returns the note-level reminder for a note (checklist_item_id === null). */
export function noteReminder(
  reminders: ChecklistReminder[],
  noteId: string,
): ChecklistReminder | undefined {
  return reminders.find((reminder) => reminder.note_id === noteId && reminder.checklist_item_id == null)
}

/** Returns the item-level reminder for a specific checklist item. */
export function reminderForItem(
  reminders: ChecklistReminder[],
  noteId: string,
  checklistItemId: string,
): ChecklistReminder | undefined {
  return reminders.find(
    (reminder) => reminder.note_id === noteId && reminder.checklist_item_id === checklistItemId,
  )
}

export function formatReminderTime(timeStr: string): string {
  if (!timeStr) return ''
  const [hStr, mStr] = timeStr.slice(0, 5).split(':')
  const h = parseInt(hStr, 10)
  if (isNaN(h)) return timeStr
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${String(hour12).padStart(2, '0')}:${mStr} ${period}`
}

export function formatRecurrenceLabel(recurrence: ReminderRecurrence): string {
  switch (recurrence) {
    case 'once': return 'Once'
    case 'daily': return 'Daily'
    case 'weekdays': return 'Weekdays'
    case 'weekly': return 'Weekly'
  }
}

export function parseLocalTime(timeStr: string): { hour12: number; minute: number; period: 'AM' | 'PM' } | null {
  if (!timeStr) return null
  const trimmed = timeStr.slice(0, 5)
  if (!validateReminderTime(trimmed)) return null
  const [hStr, mStr] = trimmed.split(':')
  const h24 = parseInt(hStr, 10)
  const minute = parseInt(mStr, 10)
  if (isNaN(h24) || isNaN(minute)) return null
  const period: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM'
  const hour12 = h24 % 12 === 0 ? 12 : h24 % 12
  return { hour12, minute, period }
}

export function to24HourTime(hour12: number, minute: number, period: 'AM' | 'PM'): string {
  const clampedHour = Math.max(1, Math.min(12, hour12))
  const clampedMin = Math.max(0, Math.min(59, minute))
  let hour24 = clampedHour
  if (period === 'AM') {
    hour24 = clampedHour === 12 ? 0 : clampedHour
  } else {
    hour24 = clampedHour === 12 ? 12 : clampedHour + 12
  }
  return `${String(hour24).padStart(2, '0')}:${String(clampedMin).padStart(2, '0')}`
}
