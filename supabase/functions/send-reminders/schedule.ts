/**
 * Pure reminder scheduling math for the `send-reminders` Edge Function.
 *
 * Deliberately free of any Deno / Supabase dependency so this exact logic can be
 * imported and unit-tested from `tests/unit/schedule.test.ts`. The Edge Function
 * and the tests must always exercise the SAME code path - never a copy.
 */

export type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

export type ReminderRecurrence = 'once' | 'daily' | 'weekdays' | 'weekly'

export type ScheduledReminder = {
  local_time: string
  timezone: string
  next_fire_at: string | null
  recurrence?: ReminderRecurrence
  day_of_week?: Weekday | null
}

export const WEEKDAY_TO_NUMBER: Record<Weekday, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}

export const REMINDER_RECURRENCES: readonly ReminderRecurrence[] = ['once', 'daily', 'weekdays', 'weekly']

/** True when `value` is a usable IANA time zone. Never throws - returns false for
 *  invalid zones (Intl.DateTimeFormat throws a RangeError only in that case). */
export function isValidTimezone(value: unknown): boolean {
  if (typeof value !== 'string' || value.trim() === '') return false
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: value }).format(new Date(0))
    return true
  } catch {
    return false
  }
}

/** True when `value` is (starts with) a valid HH:MM wall-clock time. Postgres
 *  `time` columns come back as "HH:MM:SS", so only the HH:MM prefix is required -
 *  the caller then slices to 5 chars exactly like the rest of this module. */
export function isValidReminderTime(value: unknown): boolean {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d/.test(value)
}

/** @deprecated kept for backward compat — use ScheduledReminder */
export type DailyScheduledReminder = ScheduledReminder

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

/** Day-of-week (0=Sun … 6=Sat) for a "YYYY-MM-DD" local date string in the given zone.
 *  We parse the date as UTC midnight and then read back the weekday in the target zone. */
export function zonedDayOfWeek(localDate: string, zone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    weekday: 'short',
  }).formatToParts(new Date(`${localDate}T12:00:00Z`))
  const dayStr = parts.find((p) => p.type === 'weekday')?.value ?? ''
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return map[dayStr] ?? 0
}

/** Returns the next Mon–Fri date strictly after the given "YYYY-MM-DD" local date. */
export function nextWeekdayDate(localDate: string, zone: string): string {
  let date = addDay(localDate)
  for (let i = 0; i < 7; i++) {
    const dow = zonedDayOfWeek(date, zone)
    if (dow >= 1 && dow <= 5) return date
    date = addDay(date)
  }
  return date // should never reach here
}

/** Returns the date exactly 7 days after the given "YYYY-MM-DD" local date string. */
export function nextWeeklyDate(localDate: string): string {
  let date = localDate
  for (let i = 0; i < 7; i++) date = addDay(date)
  return date
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

/** The next scheduled fire time for a **daily** reminder. Computed from the existing
 * `next_fire_at` when present (so a cron run that's a little late doesn't skip a
 * due occurrence - that occurrence is handled by the caller, and this schedules
 * the NEXT one), otherwise from the current time. Always strictly after the reference. */
export function nextFireAt(reminder: ScheduledReminder, now = new Date()): string {
  const reference = reminder.next_fire_at ? new Date(reminder.next_fire_at) : now
  const zone = reminder.timezone
  let localDate = zonedDateStr(reference, zone)
  let candidate = zonedWallClockToUtc(localDate, reminder.local_time.slice(0, 5), zone)
  if (candidate.getTime() <= reference.getTime()) {
    localDate = addDay(localDate)
    candidate = zonedWallClockToUtc(localDate, reminder.local_time.slice(0, 5), zone)
  }
  return candidate.toISOString()
}

/**
 * Recurrence-aware next fire time.
 *
 * `once`     → returns null (caller must disable the reminder after claiming).
 * `daily`    → advances one calendar day (existing logic).
 * `weekdays` → advances to the next Mon–Fri in the reminder timezone.
 * `weekly`   → advances exactly 7 days (preserves weekday).
 *
 * For all repeating modes, the reference point is `next_fire_at` when present
 * (so a slightly-late cron doesn't skip the current occurrence — it fires now
 * and then schedules the next one from the due date).
 */
export function nextFireAtForRecurrence(reminder: ScheduledReminder, now = new Date()): string | null {
  const recurrence: ReminderRecurrence = reminder.recurrence ?? 'daily'
  if (recurrence === 'once') return null

  const reference = reminder.next_fire_at ? new Date(reminder.next_fire_at) : now
  const zone = reminder.timezone
  const localTime = reminder.local_time.slice(0, 5)
  let localDate = zonedDateStr(reference, zone)

  if (recurrence === 'daily') {
    let candidate = zonedWallClockToUtc(localDate, localTime, zone)
    if (candidate.getTime() <= reference.getTime()) {
      localDate = addDay(localDate)
      candidate = zonedWallClockToUtc(localDate, localTime, zone)
    }
    return candidate.toISOString()
  }

  if (recurrence === 'weekdays') {
    // Advance from current local date until we find a weekday occurrence strictly after reference.
    let candidate = zonedWallClockToUtc(localDate, localTime, zone)
    if (candidate.getTime() <= reference.getTime()) {
      localDate = addDay(localDate)
    }
    // Skip weekends
    for (let i = 0; i < 14; i++) {
      const dow = zonedDayOfWeek(localDate, zone)
      if (dow >= 1 && dow <= 5) {
        candidate = zonedWallClockToUtc(localDate, localTime, zone)
        if (candidate.getTime() > reference.getTime()) return candidate.toISOString()
      }
      localDate = addDay(localDate)
    }
    // Fallback (should not happen)
    return zonedWallClockToUtc(nextWeekdayDate(localDate, zone), localTime, zone).toISOString()
  }

  if (recurrence === 'weekly') {
    // A prior fire date is trustworthy: advance exactly 7 days to preserve the weekday.
    if (reminder.next_fire_at) {
      const nextDate = nextWeeklyDate(zonedDateStr(reference, zone))
      return zonedWallClockToUtc(nextDate, localTime, zone).toISOString()
    }
    // No prior schedule yet (e.g. freshly inserted row): honor the stored day_of_week
    // (falling back to today's weekday when unset on legacy rows), matching the
    // client-side computeNextFireAt so the first occurrence can never land on the
    // wrong weekday.
    const targetDow = reminder.day_of_week
      ? WEEKDAY_TO_NUMBER[reminder.day_of_week]
      : zonedDayOfWeek(zonedDateStr(now, zone), zone)
    let cursor = zonedDateStr(now, zone)
    for (let i = 0; i < 14; i++) {
      if (zonedDayOfWeek(cursor, zone) === targetDow) {
        const candidate = zonedWallClockToUtc(cursor, localTime, zone)
        if (candidate.getTime() > now.getTime()) return candidate.toISOString()
      }
      cursor = addDay(cursor)
    }
    return zonedWallClockToUtc(cursor, localTime, zone).toISOString()
  }

  // Fallback to daily
  return nextFireAt(reminder, now)
}

export type NoteRecord = {
  title?: string
  deleted_at: string | null
  checklist?: { id?: string; text?: string; done?: boolean }[]
}

/**
 * Validates whether a due reminder should be executed or disabled.
 * Note-level reminder (checklist_item_id is null/empty):
 *   valid when note exists AND note.deleted_at === null (does NOT require checklist items).
 * Item-level reminder (checklist_item_id is string):
 *   valid when note exists, note.deleted_at === null, AND note.checklist contains the item.
 */
export function isReminderValid(
  reminder: { checklist_item_id: string | null },
  note?: NoteRecord,
): boolean {
  if (!note || note.deleted_at !== null) return false
  const isNoteLevel = reminder.checklist_item_id == null || reminder.checklist_item_id === ''
  if (isNoteLevel) return true
  const hasItem = note.checklist?.some((entry) => entry.id === reminder.checklist_item_id)
  return Boolean(hasItem)
}

export type ReminderPreflightError =
  | 'invalid-reminder'
  | 'malformed-note'
  | 'invalid-recurrence'
  | 'invalid-local-time'
  | 'invalid-timezone'
  | 'invalid-next-fire-at'
  | 'invalid-weekday'

export type ReminderPreflight = { ok: true; note: NoteRecord } | { ok: false; reason: ReminderPreflightError }

export type ReminderPreflightInput = {
  checklist_item_id: string | null
  recurrence?: ReminderRecurrence | null
  day_of_week?: Weekday | null
  local_time: string
  timezone: string
  next_fire_at?: string | null
  notes?: NoteRecord | NoteRecord[] | null
}

/**
 * Deterministically validates every locally-checkable property of a due reminder
 * BEFORE its occurrence is claimed. This is what keeps a malformed note/checklist,
 * invalid timezone, or malformed recurrence / local_time / next_fire_at from ever
 * consuming an occurrence or aborting the batch:
 *
 *   - note missing / soft-deleted  → 'invalid-reminder'   (disable, never fire)
 *   - referenced checklist item gone → 'invalid-reminder' (disable, never fire)
 *   - note/checklist shape unusable  → 'malformed-note'   (disable)
 *   - recurrence not one of the enum → 'invalid-recurrence'
 *   - local_time not HH:MM           → 'invalid-local-time'
 *   - timezone not a usable IANA zone→ 'invalid-timezone' (never claim)
 *   - next_fire_at unparseable       → 'invalid-next-fire-at'
 *   - weekly day_of_week unknown     → 'invalid-weekday'
 *
 * A failure always means "do not claim": the invalid timezone can never convert
 * to a date AFTER the occurrence was claimed, so no occurrence is ever lost.
 */
export function preflightReminder(reminder: ReminderPreflightInput): ReminderPreflight {
  const note = normalizeNote(reminder.notes)
  if (note == null) return { ok: false, reason: 'invalid-reminder' }
  if (typeof note !== 'object' || Array.isArray(note)) return { ok: false, reason: 'malformed-note' }

  const checklist = note.checklist
  if (checklist != null) {
    if (!Array.isArray(checklist)) return { ok: false, reason: 'malformed-note' }
    if (checklist.some((entry) => entry === null || Array.isArray(entry) || typeof entry !== 'object')) {
      return { ok: false, reason: 'malformed-note' }
    }
  }

  if (note.deleted_at !== null) return { ok: false, reason: 'invalid-reminder' }
  if (!isReminderValid(reminder, note)) return { ok: false, reason: 'invalid-reminder' }

  const recurrence = reminder.recurrence ?? 'daily'
  if (!REMINDER_RECURRENCES.includes(recurrence)) return { ok: false, reason: 'invalid-recurrence' }

  if (!isValidReminderTime(reminder.local_time)) return { ok: false, reason: 'invalid-local-time' }

  if (!isValidTimezone(reminder.timezone)) return { ok: false, reason: 'invalid-timezone' }

  if (reminder.next_fire_at != null && Number.isNaN(new Date(reminder.next_fire_at).getTime())) {
    return { ok: false, reason: 'invalid-next-fire-at' }
  }

  if (recurrence === 'weekly' && reminder.day_of_week != null && !(reminder.day_of_week in WEEKDAY_TO_NUMBER)) {
    return { ok: false, reason: 'invalid-weekday' }
  }

  return { ok: true, note }
}

/**
 * Constructs title and body for web push notification.
 * Note-level: title = note.title || "Raj's Vault", body = "N checklist task(s) remaining."
 * Item-level: title = item.text, body = From "<note title>" · N task(s) remaining.
 */
export function buildNotificationContent(
  reminder: { checklist_item_id: string | null },
  note: NoteRecord,
): { title: string; body: string } {
  const incompleteCount = note.checklist?.filter((i) => !i.done)?.length ?? 0

  const isNoteLevel = reminder.checklist_item_id == null || reminder.checklist_item_id === ''
  if (isNoteLevel) {
    const title = note.title?.trim() || "Raj's Vault"
    const body = incompleteCount === 0
      ? 'No checklist tasks remaining.'
      : incompleteCount === 1
        ? '1 checklist task remaining.'
        : `${incompleteCount} checklist tasks remaining.`
    return { title, body }
  }

  const checklistItem = note.checklist?.find((entry) => entry.id === reminder.checklist_item_id)
  const title = checklistItem?.text?.trim() || note.title?.trim() || "Raj's Vault"
  const noteTitle = note.title?.trim() || "Raj's Vault"
  const remaining = incompleteCount === 0
    ? 'No tasks remaining.'
    : incompleteCount === 1
      ? '1 task remaining.'
      : `${incompleteCount} tasks remaining.`
  const body = `From \u201c${noteTitle}\u201d \u00b7 ${remaining}`
  return { title, body }
}

/** PostgREST returns the embedded note as a plain object for many-to-one
 *  relationships (reminders.note_id -> notes.id). Older or edge-case PostgREST
 *  versions may return it as a single-element array. Normalise both shapes to
 *  the actual note record (or undefined when missing/empty). */
export function normalizeNote(notes: NoteRecord | NoteRecord[] | null | undefined): NoteRecord | undefined {
  if (notes == null) return undefined
  if (Array.isArray(notes)) return notes[0]
  return notes
}

/** True when a daily completion row exists for (reminder_id, local_date). */
export function hasCompletionOnDate(
  completions: { reminder_id: string; local_date: string }[],
  reminderId: string,
  localDate: string,
): boolean {
  return completions.some(
    (completion) => completion.reminder_id === reminderId && completion.local_date === localDate,
  )
}

export type PushSubscriptionRecord = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

export type WebPushSubscription = {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

/**
 * Transforms a flat DB push subscription record into the nested
 * { endpoint, keys: { p256dh, auth } } structure required by web-push.
 */
export function formatWebPushSubscription(sub: {
  endpoint: string
  p256dh: string
  auth: string
}): WebPushSubscription {
  return {
    endpoint: sub.endpoint,
    keys: {
      p256dh: sub.p256dh,
      auth: sub.auth,
    },
  }
}

/** Returns true if the status code indicates an expired/unregistered subscription (404 Not Found or 410 Gone). */
export function isSubscriptionGone(statusCode?: number | null): boolean {
  return statusCode === 404 || statusCode === 410
}
