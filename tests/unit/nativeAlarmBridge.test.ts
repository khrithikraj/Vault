import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Capacitor } from '@capacitor/core'
import {
  reconcileNativeAlarms,
  getLaunchReminderId,
  clearLaunchReminderId,
  VaultAlarm,
  type ScheduledAlarmItem,
  type ReconcileReminderInput,
  type ReconcileCompletionInput,
} from '../../src/native/alarmBridge'
import { resolveNextFireAt } from '../../src/lib/reminders'

const KOLKATA = 'Asia/Kolkata'
const NEW_YORK = 'America/New_York'

describe('Native Alarm Bridge & Recurrence Parity', () => {
    beforeEach(() => {
      vi.restoreAllMocks()
      ;(globalThis as unknown as { window: typeof globalThis }).window = globalThis
      vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
      vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android')
    })
  describe('Cross-language parity between TypeScript and Java', () => {
    it('agrees on daily recurrence before scheduled time', () => {
      // Tuesday 2026-09-15 08:00:00 UTC (13:30 IST)
      const now = new Date('2026-09-15T08:00:00.000Z')
      const res = resolveNextFireAt({
        localTime: '14:00',
        recurrence: 'daily',
        timezone: KOLKATA,
        now,
      })
      // 14:00 IST = 08:30 UTC -> 1789461000000 ms
      expect(new Date(res).getTime()).toBe(1789461000000)
    })

    it('agrees on daily recurrence after scheduled time (advances +1 day)', () => {
      const now = new Date('2026-09-15T08:00:00.000Z') // 13:30 IST
      const res = resolveNextFireAt({
        localTime: '13:00',
        recurrence: 'daily',
        timezone: KOLKATA,
        now,
      })
      // Tomorrow 2026-09-16 13:00 IST = 07:30 UTC -> 1789543800000 ms
      expect(new Date(res).getTime()).toBe(1789543800000)
    })

    it('agrees on weekdays recurrence skipping Friday afternoon to Monday', () => {
      // Friday 2026-09-18 10:00:00 UTC = 15:30 IST
      const fridayAfternoon = new Date('2026-09-18T10:00:00.000Z')
      const resFriday = resolveNextFireAt({
        localTime: '14:00',
        recurrence: 'weekdays',
        timezone: KOLKATA,
        now: fridayAfternoon,
      })
      // Monday 2026-09-21 14:00 IST = 08:30 UTC -> 1789979400000 ms
      expect(new Date(resFriday).getTime()).toBe(1789979400000)

      // Saturday 2026-09-19 06:00:00 UTC = 11:30 IST
      const saturday = new Date('2026-09-19T06:00:00.000Z')
      const resSaturday = resolveNextFireAt({
        localTime: '14:00',
        recurrence: 'weekdays',
        timezone: KOLKATA,
        now: saturday,
      })
      expect(new Date(resSaturday).getTime()).toBe(1789979400000)

      // Sunday 2026-09-20 06:00:00 UTC = 11:30 IST
      const sunday = new Date('2026-09-20T06:00:00.000Z')
      const resSunday = resolveNextFireAt({
        localTime: '14:00',
        recurrence: 'weekdays',
        timezone: KOLKATA,
        now: sunday,
      })
      expect(new Date(resSunday).getTime()).toBe(1789979400000)
    })

    it('agrees on weekly recurrence targeting specific weekday', () => {
      // Tuesday 2026-09-15 08:00:00 UTC = 13:30 IST
      const now = new Date('2026-09-15T08:00:00.000Z')

      // Thursday at 10:00 IST -> 2026-09-17 10:00 IST = 04:30 UTC -> 1789619400000 ms
      const resThursday = resolveNextFireAt({
        localTime: '10:00',
        recurrence: 'weekly',
        dayOfWeek: 'thursday',
        timezone: KOLKATA,
        now,
      })
      expect(new Date(resThursday).getTime()).toBe(1789619400000)

      // Tuesday at 10:00 IST (already passed today) -> next Tuesday 2026-09-22 10:00 IST = 04:30 UTC -> 1790051400000 ms
      const resTuesday = resolveNextFireAt({
        localTime: '10:00',
        recurrence: 'weekly',
        dayOfWeek: 'tuesday',
        timezone: KOLKATA,
        now,
      })
      expect(new Date(resTuesday).getTime()).toBe(1790051400000)
    })

    it('agrees on weekly recurrence fallback when dayOfWeek is omitted', () => {
      // Tuesday 2026-09-15 08:00:00 UTC = 13:30 IST
      const now = new Date('2026-09-15T08:00:00.000Z')
      const resFallback = resolveNextFireAt({
        localTime: '10:00',
        recurrence: 'weekly',
        dayOfWeek: null,
        timezone: KOLKATA,
        now,
      })
      expect(new Date(resFallback).getTime()).toBe(1790051400000)
    })

    it('agrees on daily recurrence across America/New_York DST transitions', () => {
      // 2026-10-31 08:00 EDT (12:00 UTC). Alarm is 09:00 EDT = 13:00 UTC
      const oct31 = new Date('2026-10-31T12:00:00.000Z')
      const resOct31 = resolveNextFireAt({
        localTime: '09:00',
        recurrence: 'daily',
        timezone: NEW_YORK,
        now: oct31,
      })
      expect(resOct31).toBe('2026-10-31T13:00:00.000Z')

      // Once 09:00 EDT has passed (say 10:00 EDT = 14:00 UTC), next daily is Nov 1 at 09:00 EST = 14:00 UTC
      const oct31After = new Date('2026-10-31T14:00:00.000Z')
      const resNov1 = resolveNextFireAt({
        localTime: '09:00',
        recurrence: 'daily',
        timezone: NEW_YORK,
        now: oct31After,
      })
      expect(resNov1).toBe('2026-11-01T14:00:00.000Z')
    })
  })

  describe('reconcileNativeAlarms state machine', () => {
    it('schedules newly added recurring reminder with full metadata', async () => {
      const scheduledOnDevice: ScheduledAlarmItem[] = []
      const scheduleCalls: Array<{
        reminderId: string
        triggerTimeMillis: number
        title?: string
        recurrence?: string
        localTime?: string
        timezone?: string
        dayOfWeek?: string | null
      }> = []
      const cancelCalls: string[] = []

      vi.spyOn(VaultAlarm, 'getScheduledAlarms').mockResolvedValue({ alarms: scheduledOnDevice })
      vi.spyOn(VaultAlarm, 'scheduleAlarm').mockImplementation(async (opts: {
        reminderId: string
        triggerTimeMillis: number
        title?: string
        recurrence?: string
        localTime?: string
        timezone?: string
        dayOfWeek?: string | null
      }) => {
        scheduleCalls.push(opts)
        return {
          scheduled: true,
          reminderId: opts.reminderId,
          triggerTimeMillis: opts.triggerTimeMillis,
          title: opts.title || '',
          recurrence: opts.recurrence,
        }
      })
      vi.spyOn(VaultAlarm, 'cancelAlarmById').mockImplementation(async (opts) => {
        cancelCalls.push(opts.reminderId)
        return { cancelled: true, reminderId: opts.reminderId }
      })

      const reminders: ReconcileReminderInput[] = [
        {
          id: 'rem-daily-1',
          enabled: true,
          recurrence: 'daily',
          local_time: '18:00',
          timezone: KOLKATA,
          next_fire_at: new Date(Date.now() + 3600000).toISOString(),
          title: 'Daily Meditation',
        },
      ]

      await reconcileNativeAlarms(reminders, [], [])

      expect(scheduleCalls).toHaveLength(1)
      expect(scheduleCalls[0].reminderId).toBe('rem-daily-1')
      expect(scheduleCalls[0].recurrence).toBe('daily')
      expect(scheduleCalls[0].localTime).toBe('18:00')
      expect(scheduleCalls[0].timezone).toBe(KOLKATA)
      expect(cancelCalls).toHaveLength(0)
    })

    it('cancels alarm when recurring reminder is disabled', async () => {
      const existingAlarm: ScheduledAlarmItem = {
        reminderId: 'rem-daily-1',
        triggerTimeMillis: Date.now() + 3600000,
        title: 'Daily Meditation',
        recurrence: 'daily',
      }
      const cancelCalls: string[] = []
      const scheduleCalls: Array<{
        reminderId: string
        triggerTimeMillis: number
        title?: string
        recurrence?: string
        localTime?: string
        timezone?: string
        dayOfWeek?: string | null
      }> = []

      vi.spyOn(VaultAlarm, 'getScheduledAlarms').mockResolvedValue({ alarms: [existingAlarm] })
      vi.spyOn(VaultAlarm, 'scheduleAlarm').mockImplementation(async (opts: {
        reminderId: string
        triggerTimeMillis: number
        title?: string
        recurrence?: string
        localTime?: string
        timezone?: string
        dayOfWeek?: string | null
      }) => {
        scheduleCalls.push(opts)
        return {
          scheduled: true,
          reminderId: opts.reminderId,
          triggerTimeMillis: opts.triggerTimeMillis,
          title: opts.title || '',
          recurrence: opts.recurrence,
        }
      })
      vi.spyOn(VaultAlarm, 'cancelAlarmById').mockImplementation(async (opts) => {
        cancelCalls.push(opts.reminderId)
        return { cancelled: true, reminderId: opts.reminderId }
      })

      const reminders: ReconcileReminderInput[] = [
        {
          id: 'rem-daily-1',
          enabled: false, // disabled!
          recurrence: 'daily',
          local_time: '18:00',
          timezone: KOLKATA,
          next_fire_at: new Date(Date.now() + 3600000).toISOString(),
          title: 'Daily Meditation',
        },
      ]

      await reconcileNativeAlarms(reminders, [], [])

      expect(cancelCalls).toContain('rem-daily-1')
      expect(scheduleCalls).toHaveLength(0)
    })

    it('reschedules when time or recurrence has been edited', async () => {
      const oldTime = Date.now() + 3600000
      const newTime = Date.now() + 7200000
      const existingAlarm: ScheduledAlarmItem = {
        reminderId: 'rem-daily-1',
        triggerTimeMillis: oldTime,
        title: 'Old Title',
        recurrence: 'daily',
      }
      const cancelCalls: string[] = []
      const scheduleCalls: Array<{
        reminderId: string
        triggerTimeMillis: number
        title?: string
        recurrence?: string
        localTime?: string
        timezone?: string
        dayOfWeek?: string | null
      }> = []

      vi.spyOn(VaultAlarm, 'getScheduledAlarms').mockResolvedValue({ alarms: [existingAlarm] })
      vi.spyOn(VaultAlarm, 'scheduleAlarm').mockImplementation(async (opts: {
        reminderId: string
        triggerTimeMillis: number
        title?: string
        recurrence?: string
        localTime?: string
        timezone?: string
        dayOfWeek?: string | null
      }) => {
        scheduleCalls.push(opts)
        return {
          scheduled: true,
          reminderId: opts.reminderId,
          triggerTimeMillis: opts.triggerTimeMillis,
          title: opts.title || '',
          recurrence: opts.recurrence,
        }
      })
      vi.spyOn(VaultAlarm, 'cancelAlarmById').mockImplementation(async (opts) => {
        cancelCalls.push(opts.reminderId)
        return { cancelled: true, reminderId: opts.reminderId }
      })

      const reminders: ReconcileReminderInput[] = [
        {
          id: 'rem-daily-1',
          enabled: true,
          recurrence: 'daily',
          local_time: '20:00',
          timezone: KOLKATA,
          next_fire_at: new Date(newTime).toISOString(),
          title: 'Updated Title',
        },
      ]

      await reconcileNativeAlarms(reminders, [], [])

      // Cancel old schedule and schedule new
      expect(cancelCalls).toContain('rem-daily-1')
      expect(scheduleCalls).toHaveLength(1)
      expect(scheduleCalls[0].triggerTimeMillis).toBe(newTime)
      expect(scheduleCalls[0].title).toBe('Updated Title')
    })

    it('advances recurring alarm to next occurrence when completed today', async () => {
      const scheduleCalls: Array<{
        reminderId: string
        triggerTimeMillis: number
        title?: string
        recurrence?: string
        localTime?: string
        timezone?: string
        dayOfWeek?: string | null
      }> = []
      vi.spyOn(VaultAlarm, 'getScheduledAlarms').mockResolvedValue({ alarms: [] })
      vi.spyOn(VaultAlarm, 'scheduleAlarm').mockImplementation(async (opts: {
        reminderId: string
        triggerTimeMillis: number
        title?: string
        recurrence?: string
        localTime?: string
        timezone?: string
        dayOfWeek?: string | null
      }) => {
        scheduleCalls.push(opts)
        return {
          scheduled: true,
          reminderId: opts.reminderId,
          triggerTimeMillis: opts.triggerTimeMillis,
          title: opts.title || '',
        }
      })

      const now = Date.now()
      const todayDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: KOLKATA,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(now))

      const reminder: ReconcileReminderInput = {
        id: 'rem-daily-completed',
        enabled: true,
        recurrence: 'daily',
        local_time: '23:00',
        timezone: KOLKATA,
        next_fire_at: new Date(now + 10000).toISOString(),
        title: 'Bedtime Journal',
      }

      const completions: ReconcileCompletionInput[] = [
        {
          reminder_id: 'rem-daily-completed',
          local_date: todayDate,
        },
      ]

      await reconcileNativeAlarms([reminder], completions, [])

      expect(scheduleCalls).toHaveLength(1)
      // Because it was completed today, the scheduled trigger must be tomorrow (at least 12 hours from now)
      expect(scheduleCalls[0].triggerTimeMillis).toBeGreaterThan(now + 12 * 3600 * 1000)
    })

    it('cancels one-time reminder when marked complete today and restores when uncompleted', async () => {
      const now = Date.now()
      const futureTrigger = now + 3600000 // 1 hour from now
      const todayDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: KOLKATA,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(now))

      const onceReminder: ReconcileReminderInput = {
        id: 'rem-once-1',
        enabled: true,
        recurrence: 'once',
        local_time: '18:00',
        timezone: KOLKATA,
        next_fire_at: new Date(futureTrigger).toISOString(),
        title: 'One Time Task',
      }

      // Step 1: Active, uncompleted -> scheduled
      const scheduledMap: ScheduledAlarmItem[] = []
      const scheduleCalls: Array<{
        reminderId: string
        triggerTimeMillis: number
        title?: string
        recurrence?: string
        localTime?: string
        timezone?: string
        dayOfWeek?: string | null
      }> = []
      const cancelCalls: string[] = []

      vi.spyOn(VaultAlarm, 'getScheduledAlarms').mockImplementation(async () => ({ alarms: [...scheduledMap] }))
      vi.spyOn(VaultAlarm, 'scheduleAlarm').mockImplementation(async (opts: {
        reminderId: string
        triggerTimeMillis: number
        title?: string
        recurrence?: string
        localTime?: string
        timezone?: string
        dayOfWeek?: string | null
      }) => {
        scheduleCalls.push(opts)
        scheduledMap.push({
          reminderId: opts.reminderId,
          triggerTimeMillis: opts.triggerTimeMillis,
          title: opts.title || '',
          recurrence: opts.recurrence,
        })
        return {
          scheduled: true,
          reminderId: opts.reminderId,
          triggerTimeMillis: opts.triggerTimeMillis,
          title: opts.title || '',
        }
      })
      vi.spyOn(VaultAlarm, 'cancelAlarmById').mockImplementation(async (opts) => {
        cancelCalls.push(opts.reminderId)
        const idx = scheduledMap.findIndex((s) => s.reminderId === opts.reminderId)
        if (idx !== -1) scheduledMap.splice(idx, 1)
        return { cancelled: true, reminderId: opts.reminderId }
      })

      await reconcileNativeAlarms([onceReminder], [], [])
      expect(scheduleCalls).toHaveLength(1)
      expect(scheduleCalls[0].reminderId).toBe('rem-once-1')

      // Step 2: User completes it -> cancelled
      scheduleCalls.length = 0
      cancelCalls.length = 0
      const completions: ReconcileCompletionInput[] = [
        { reminder_id: 'rem-once-1', local_date: todayDate },
      ]

      await reconcileNativeAlarms([onceReminder], completions, [])
      expect(cancelCalls).toContain('rem-once-1')
      expect(scheduleCalls).toHaveLength(0)

      // Step 3: User uncompletes it -> restored
      scheduleCalls.length = 0
      cancelCalls.length = 0
      await reconcileNativeAlarms([onceReminder], [], [])
      expect(scheduleCalls).toHaveLength(1)
      expect(scheduleCalls[0].reminderId).toBe('rem-once-1')
    })

    it('uncompleting a recurring reminder restores today alarm if time is in future', async () => {
      const now = Date.now()
      const futureTimeToday = now + 1800000 // 30 mins from now

      const reminder: ReconcileReminderInput = {
        id: 'rem-daily-restore',
        enabled: true,
        recurrence: 'daily',
        local_time: '23:59',
        timezone: KOLKATA,
        next_fire_at: new Date(futureTimeToday).toISOString(),
        title: 'Daily Check',
      }

      const scheduleCalls: Array<{
        reminderId: string
        triggerTimeMillis: number
        title?: string
        recurrence?: string
        localTime?: string
        timezone?: string
        dayOfWeek?: string | null
      }> = []
      vi.spyOn(VaultAlarm, 'getScheduledAlarms').mockResolvedValue({ alarms: [] })
      vi.spyOn(VaultAlarm, 'scheduleAlarm').mockImplementation(async (opts: {
        reminderId: string
        triggerTimeMillis: number
        title?: string
        recurrence?: string
        localTime?: string
        timezone?: string
        dayOfWeek?: string | null
      }) => {
        scheduleCalls.push(opts)
        return {
          scheduled: true,
          reminderId: opts.reminderId,
          triggerTimeMillis: opts.triggerTimeMillis,
          title: opts.title || '',
        }
      })

      // Uncompleted today -> should schedule today (within the next 2 hours)
      await reconcileNativeAlarms([reminder], [], [])
      expect(scheduleCalls).toHaveLength(1)
      expect(scheduleCalls[0].triggerTimeMillis).toBe(futureTimeToday)
    })

    it('reboot recovery preserves existing matching alarms without churn', async () => {
      const now = Date.now()
      const validFutureTime = now + 3600000

      const existingAlarm: ScheduledAlarmItem = {
        reminderId: 'rem-persisted-1',
        triggerTimeMillis: validFutureTime,
        title: 'Morning Alarm',
        recurrence: 'daily',
      }

      const scheduleCalls: Array<{
        reminderId: string
        triggerTimeMillis: number
        title?: string
        recurrence?: string
        localTime?: string
        timezone?: string
        dayOfWeek?: string | null
      }> = []
      const cancelCalls: string[] = []

      vi.spyOn(VaultAlarm, 'getScheduledAlarms').mockResolvedValue({ alarms: [existingAlarm] })
      vi.spyOn(VaultAlarm, 'scheduleAlarm').mockImplementation(async (opts: {
        reminderId: string
        triggerTimeMillis: number
        title?: string
        recurrence?: string
        localTime?: string
        timezone?: string
        dayOfWeek?: string | null
      }) => {
        scheduleCalls.push(opts)
        return { scheduled: true, reminderId: opts.reminderId, triggerTimeMillis: opts.triggerTimeMillis, title: '' }
      })
      vi.spyOn(VaultAlarm, 'cancelAlarmById').mockImplementation(async (opts) => {
        cancelCalls.push(opts.reminderId)
        return { cancelled: true, reminderId: opts.reminderId }
      })

      const reminders: ReconcileReminderInput[] = [
        {
          id: 'rem-persisted-1',
          enabled: true,
          recurrence: 'daily',
          local_time: '08:00',
          timezone: KOLKATA,
          next_fire_at: new Date(validFutureTime).toISOString(),
          title: 'Morning Alarm',
        },
      ]

      await reconcileNativeAlarms(reminders, [], [])

      // Since the scheduled alarm matches the desired state within 2s, no cancel or reschedule is needed
      expect(cancelCalls).toHaveLength(0)
      expect(scheduleCalls).toHaveLength(0)
    })

    it('handles day-boundary and midnight transitions correctly', () => {
      // 23:55 in Kolkata on 2026-09-15 is 18:25 UTC on 2026-09-15.
      // An alarm for 00:05 IST falls on 2026-09-16 00:05 IST = 2026-09-15 18:35 UTC.
      const nowNearMidnight = new Date('2026-09-15T18:25:00.000Z')
      const next = resolveNextFireAt({
        localTime: '00:05',
        recurrence: 'daily',
        timezone: KOLKATA,
        now: nowNearMidnight,
      })
      expect(next).toBe('2026-09-15T18:35:00.000Z')

      // Once 00:05 has passed (say 00:10 IST = 18:40 UTC), it advances to 2026-09-17 00:05 IST = 2026-09-16 18:35 UTC
      const nowPastMidnight = new Date('2026-09-15T18:40:00.000Z')
      const nextAfter = resolveNextFireAt({
        localTime: '00:05',
        recurrence: 'daily',
        timezone: KOLKATA,
        now: nowPastMidnight,
      })
      expect(nextAfter).toBe('2026-09-16T18:35:00.000Z')
    })
  })

  describe('VIEW IN VAULT Launch Navigation Bridge', () => {
    it('retrieves and clears launch reminder ID', async () => {
      let storedLaunchId: string | null = 'rem-vault-launch-123'

      vi.spyOn(VaultAlarm, 'getLaunchReminder').mockImplementation(async () => ({
        reminderId: storedLaunchId,
      }))
      vi.spyOn(VaultAlarm, 'clearLaunchReminder').mockImplementation(async () => {
        storedLaunchId = null
        return { cleared: true }
      })

      const id = await getLaunchReminderId()
      expect(id).toBe('rem-vault-launch-123')

      await clearLaunchReminderId()
      const clearedId = await getLaunchReminderId()
      expect(clearedId).toBeNull()
    })

    it('routes to note detail when launch reminder is attached to a note', () => {
      const mockReminders = [
        { id: 'rem-note-1', note_id: 'note-uuid-999', title: 'Check item' },
        { id: 'rem-standalone-1', note_id: null, title: 'Drink water' },
      ]

      const openedNotes: string[] = []
      const openedSections: string[] = []
      const editedReminders: Array<Record<string, unknown>> = []

      const handleOpenNote = (noteId: string) => openedNotes.push(noteId)
      const goToSection = (section: string) => openedSections.push(section)
      const handleEditReminder = (rem: Record<string, unknown>) => editedReminders.push(rem)

      // Test routing helper
      function routeLaunchReminder(reminderId: string) {
        const reminder = mockReminders.find((r) => r.id === reminderId)
        if (reminder) {
          if (reminder.note_id) {
            handleOpenNote(reminder.note_id)
          } else {
            goToSection('reminders')
            handleEditReminder(reminder)
          }
        } else {
          goToSection('reminders')
        }
      }

      routeLaunchReminder('rem-note-1')
      expect(openedNotes).toEqual(['note-uuid-999'])
      expect(openedSections).toHaveLength(0)
      expect(editedReminders).toHaveLength(0)

      routeLaunchReminder('rem-standalone-1')
      expect(openedSections).toEqual(['reminders'])
      expect(editedReminders).toEqual([mockReminders[1]])

      routeLaunchReminder('unknown-id')
      expect(openedSections).toEqual(['reminders', 'reminders'])
    })
  })
})
