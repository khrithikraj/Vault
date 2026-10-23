import { registerPlugin, Capacitor } from '@capacitor/core'
import { resolveNextFireAt, type ReminderRecurrence } from '../lib/reminders'
import type { Weekday } from '../types/app'

export interface VaultAlarmPermissions {
  exactAlarmGranted: boolean
  notificationsGranted: boolean
  fullScreenIntentGranted?: boolean
}

export interface ExactAlarmRequestResult {
  opened: boolean
  alreadyGranted: boolean
}

export interface NotificationRequestResult {
  notifications: 'granted' | 'denied' | 'prompt'
}

export interface FullScreenIntentSettingsResult {
  opened: boolean
}

export interface ScheduleAlarmResult {
  scheduled: boolean
  triggerTimeMillis: number
  secondsFromNow: number
}

export interface ScheduleRealAlarmOptions {
  reminderId: string
  triggerTimeMillis: number
  title?: string
  recurrence?: string
  localTime?: string
  timezone?: string
  dayOfWeek?: string | null
}

export interface ScheduleRealAlarmResult {
  scheduled: boolean
  reminderId: string
  triggerTimeMillis: number
  title: string
  recurrence?: string
}

export interface CancelAlarmResult {
  cancelled: boolean
}

export interface CancelAlarmByIdResult {
  cancelled: boolean
  reminderId: string
}

export interface ScheduledAlarmItem {
  reminderId: string
  triggerTimeMillis: number
  title: string
  recurrence?: string
  localTime?: string
  timezone?: string
  dayOfWeek?: string | null
  isPast?: boolean
}

export interface GetScheduledAlarmsResult {
  alarms: ScheduledAlarmItem[]
}

export interface RingingStatusResult {
  isRinging: boolean
}

export interface SnoozeAlarmResult {
  snoozed: boolean
  snoozeSeconds: number
  triggerTimeMillis: number
}

export interface RingtoneSelectionResult {
  selected: boolean
  uri: string | null
  title: string
  isDefault: boolean
}

export interface RingtoneInfoResult {
  uri: string | null
  title: string
  isDefault: boolean
}

export interface RingtoneResetResult {
  reset: boolean
  uri: null
  title: string
  isDefault: boolean
}

export interface PreviewRingtoneResult {
  playing: boolean
  title: string
}

export interface StopPreviewResult {
  stopped: boolean
}

/**
 * The raw Capacitor plugin interface.
 *
 * Note: the native method is named `getAlarmPermissions` (not `checkPermissions`) to avoid
 * a method-name collision with Capacitor's reserved base Plugin.checkPermissions().
 * That collision causes PluginHandle.indexMethods() to overwrite our method entry in its
 * HashMap, and any invocation exception is silently swallowed — leaving the JS Promise
 * pending forever.  The public-facing helper `checkAlarmPermissions()` / the VaultAlarm
 * proxy alias below both call `getAlarmPermissions` transparently.
 */
export interface VaultAlarmPlugin {
  /** @internal — call checkPermissions() via the VaultAlarm proxy or checkAlarmPermissions() */
  getAlarmPermissions(): Promise<VaultAlarmPermissions>
  requestExactAlarmPermission(): Promise<ExactAlarmRequestResult>
  requestNotificationPermission(): Promise<NotificationRequestResult>
  openFullScreenIntentSettings(): Promise<FullScreenIntentSettingsResult>
  scheduleTestAlarm(options?: {
    secondsFromNow?: number
    title?: string
  }): Promise<ScheduleAlarmResult>
  scheduleAlarm(options: ScheduleRealAlarmOptions): Promise<ScheduleRealAlarmResult>
  cancelAlarm(): Promise<CancelAlarmResult>
  cancelAlarmById(options: { reminderId: string }): Promise<CancelAlarmByIdResult>
  getScheduledAlarms(): Promise<GetScheduledAlarmsResult>
  isRinging(): Promise<RingingStatusResult>
  snoozeAlarm(options?: {
    seconds?: number
    title?: string
  }): Promise<SnoozeAlarmResult>
  selectRingtone(): Promise<RingtoneSelectionResult>
  getRingtone(): Promise<RingtoneInfoResult>
  resetRingtone(): Promise<RingtoneResetResult>
  previewRingtone(): Promise<PreviewRingtoneResult>
  stopRingtonePreview(): Promise<StopPreviewResult>
  getLaunchReminder(): Promise<{ reminderId: string | null }>
  clearLaunchReminder(): Promise<{ cleared: boolean }>
}

const _NativeVaultAlarm = registerPlugin<VaultAlarmPlugin>('VaultAlarm')

/**
 * Public proxy — exposes the same API surface but routes checkPermissions()
 * to the native getAlarmPermissions() to avoid the Capacitor base-method collision.
 */
export const VaultAlarm = {
  /** Checks exact-alarm + notification permission state. */
  checkPermissions(): Promise<VaultAlarmPermissions> {
    return _NativeVaultAlarm.getAlarmPermissions()
  },
  requestExactAlarmPermission(): Promise<ExactAlarmRequestResult> {
    return _NativeVaultAlarm.requestExactAlarmPermission()
  },
  requestNotificationPermission(): Promise<NotificationRequestResult> {
    return _NativeVaultAlarm.requestNotificationPermission()
  },
  openFullScreenIntentSettings(): Promise<FullScreenIntentSettingsResult> {
    return _NativeVaultAlarm.openFullScreenIntentSettings()
  },
  scheduleTestAlarm(options?: {
    secondsFromNow?: number
    title?: string
  }): Promise<ScheduleAlarmResult> {
    return _NativeVaultAlarm.scheduleTestAlarm(options)
  },
  scheduleAlarm(options: ScheduleRealAlarmOptions): Promise<ScheduleRealAlarmResult> {
    return _NativeVaultAlarm.scheduleAlarm(options)
  },
  cancelAlarm(): Promise<CancelAlarmResult> {
    return _NativeVaultAlarm.cancelAlarm()
  },
  cancelAlarmById(options: { reminderId: string }): Promise<CancelAlarmByIdResult> {
    return _NativeVaultAlarm.cancelAlarmById(options)
  },
  getScheduledAlarms(): Promise<GetScheduledAlarmsResult> {
    return _NativeVaultAlarm.getScheduledAlarms()
  },
  getLaunchReminder(): Promise<{ reminderId: string | null }> {
    return _NativeVaultAlarm.getLaunchReminder()
  },
  clearLaunchReminder(): Promise<{ cleared: boolean }> {
    return _NativeVaultAlarm.clearLaunchReminder()
  },
  stopAlarm(): Promise<CancelAlarmResult> {
    return _NativeVaultAlarm.cancelAlarm()
  },
  isRinging(): Promise<RingingStatusResult> {
    return _NativeVaultAlarm.isRinging()
  },
  snoozeAlarm(options?: {
    seconds?: number
    title?: string
  }): Promise<SnoozeAlarmResult> {
    return _NativeVaultAlarm.snoozeAlarm(options)
  },
  selectRingtone(): Promise<RingtoneSelectionResult> {
    return _NativeVaultAlarm.selectRingtone()
  },
  getRingtone(): Promise<RingtoneInfoResult> {
    return _NativeVaultAlarm.getRingtone()
  },
  resetRingtone(): Promise<RingtoneResetResult> {
    return _NativeVaultAlarm.resetRingtone()
  },
  previewRingtone(): Promise<PreviewRingtoneResult> {
    return _NativeVaultAlarm.previewRingtone()
  },
  stopRingtonePreview(): Promise<StopPreviewResult> {
    return _NativeVaultAlarm.stopRingtonePreview()
  },
}

/**
 * Checks whether both exact alarm scheduling and notification display permissions are granted.
 */
export async function checkAlarmPermissions(): Promise<VaultAlarmPermissions> {
  return VaultAlarm.checkPermissions()
}

/**
 * Opens system settings for exact alarms if not yet granted on Android 12+.
 */
export async function requestExactAlarmPermission(): Promise<ExactAlarmRequestResult> {
  return VaultAlarm.requestExactAlarmPermission()
}

/**
 * Requests the notification runtime permission on Android 13+.
 */
export async function requestNotificationPermission(): Promise<NotificationRequestResult> {
  return VaultAlarm.requestNotificationPermission()
}

/**
 * Opens system settings for full-screen intent special app access on Android 14+.
 */
export async function openFullScreenIntentSettings(): Promise<FullScreenIntentSettingsResult> {
  return VaultAlarm.openFullScreenIntentSettings()
}

/**
 * Schedules a one-time exact alarm using Android AlarmManager.setAlarmClock().
 *
 * @param secondsFromNow Number of seconds in the future (default: 10s)
 * @param title Optional title displayed on the alarm notification
 */
export async function scheduleTestAlarm(
  secondsFromNow = 10,
  title = 'Vault Test Alarm',
): Promise<ScheduleAlarmResult> {
  return VaultAlarm.scheduleTestAlarm({ secondsFromNow, title })
}

/**
 * Cancels any pending test alarm and stops currently ringing audio.
 */
export async function cancelAlarm(): Promise<CancelAlarmResult> {
  return VaultAlarm.cancelAlarm()
}

/**
 * Stops any actively ringing alarm and cancels pending alarms.
 */
export async function stopAlarm(): Promise<CancelAlarmResult> {
  return VaultAlarm.stopAlarm()
}

/**
 * Snoozes any ringing alarm for the specified seconds (default 300s = 5m).
 */
export async function snoozeAlarm(
  seconds = 300,
  title = 'Vault Alarm (Snoozed)',
): Promise<SnoozeAlarmResult> {
  return VaultAlarm.snoozeAlarm({ seconds, title })
}

/**
 * Returns whether the alarm audio/service is actively running.
 */
export async function isAlarmRinging(): Promise<boolean> {
  const result = await VaultAlarm.isRinging()
  return result.isRinging
}

/**
 * Opens Android's native ringtone picker dialog for alarm tones.
 * Allows user to audition/preview tones and saves the chosen URI on-device.
 */
export async function selectAlarmRingtone(): Promise<RingtoneSelectionResult> {
  return VaultAlarm.selectRingtone()
}

/**
 * Reads the currently configured alarm ringtone URI and title.
 */
export async function getAlarmRingtone(): Promise<RingtoneInfoResult> {
  return VaultAlarm.getRingtone()
}

/**
 * Resets the alarm tone back to system default.
 */
export async function resetAlarmRingtone(): Promise<RingtoneResetResult> {
  return VaultAlarm.resetRingtone()
}

/**
 * Previews the configured alarm tone.
 */
export async function previewAlarmRingtone(): Promise<PreviewRingtoneResult> {
  return VaultAlarm.previewRingtone()
}

/**
 * Stops preview playback.
 */
export async function stopAlarmRingtonePreview(): Promise<StopPreviewResult> {
  return VaultAlarm.stopRingtonePreview()
}

/**
 * Checks whether native Android alarm scheduling is available in the current environment.
 */
export function isNativeAlarmAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    Capacitor.isNativePlatform() &&
    Capacitor.getPlatform() === 'android'
  )
}

/**
 * Schedules an exact native Android alarm for a real one-time reminder.
 */
export async function scheduleNativeAlarm(
  options: ScheduleRealAlarmOptions,
): Promise<ScheduleRealAlarmResult | null> {
  if (!isNativeAlarmAvailable()) return null
  try {
    return await VaultAlarm.scheduleAlarm(options)
  } catch (err) {
    console.warn('Native alarm schedule failed:', err)
    return null
  }
}

/**
 * Cancels a pending native Android alarm for a specific reminder ID.
 */
export async function cancelNativeAlarmById(
  reminderId: string,
): Promise<CancelAlarmByIdResult | null> {
  if (!isNativeAlarmAvailable() || !reminderId) return null
  try {
    return await VaultAlarm.cancelAlarmById({ reminderId })
  } catch (err) {
    console.warn('Native alarm cancel failed:', err)
    return null
  }
}

/**
 * Returns all currently scheduled native alarms stored on device.
 */
export async function getNativeScheduledAlarms(): Promise<ScheduledAlarmItem[]> {
  if (!isNativeAlarmAvailable()) return []
  try {
    const res = await VaultAlarm.getScheduledAlarms()
    return res?.alarms || []
  } catch (err) {
    console.warn('getNativeScheduledAlarms failed:', err)
    return []
  }
}

/**
 * Returns the reminder ID that triggered the app launch (via "VIEW IN VAULT"), or null.
 */
export async function getLaunchReminderId(): Promise<string | null> {
  if (!isNativeAlarmAvailable()) return null
  try {
    const res = await VaultAlarm.getLaunchReminder()
    return res?.reminderId || null
  } catch (err) {
    console.warn('getLaunchReminderId failed:', err)
    return null
  }
}

/**
 * Clears the pending launch reminder ID once consumed.
 */
export async function clearLaunchReminderId(): Promise<void> {
  if (!isNativeAlarmAvailable()) return
  try {
    await VaultAlarm.clearLaunchReminder()
  } catch (err) {
    console.warn('clearLaunchReminderId failed:', err)
  }
}

export interface ReconcileReminderInput {
  id: string
  enabled: boolean
  recurrence?: string | null
  local_time?: string | null
  timezone?: string | null
  day_of_week?: string | null
  next_fire_at: string | null
  title?: string | null
  note_id?: string | null
}

export interface ReconcileCompletionInput {
  reminder_id: string
  local_date: string
}

/**
 * Reconciles native Android alarms with the latest set of reminders.
 * Manages both one-time ('once') and recurring ('daily', 'weekdays', 'weekly') reminders.
 */
export async function reconcileNativeAlarms(
  reminders: ReconcileReminderInput[],
  dailyCompletions: ReconcileCompletionInput[] = [],
  notes: Array<{ id: string; title: string }> = [],
): Promise<void> {
  if (!isNativeAlarmAvailable()) return

  try {
    const scheduled = await getNativeScheduledAlarms()
    const scheduledMap = new Map<string, ScheduledAlarmItem>()
    for (const item of scheduled) {
      scheduledMap.set(item.reminderId, item)
    }

    const now = Date.now()
    const activeTargets = new Map<
      string,
      {
        id: string
        triggerTimeMillis: number
        title: string
        recurrence: string
        localTime?: string
        timezone?: string
        dayOfWeek?: string | null
      }
    >()

    const notesById = new Map(notes.map((n) => [n.id, n.title]))

    for (const r of reminders) {
      if (!r.enabled) continue

      const recurrence = r.recurrence || 'daily'
      const timezone = r.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      const noteTitle = r.note_id ? notesById.get(r.note_id) : undefined
      const title = r.title?.trim() || noteTitle?.trim() || 'Vault Reminder'
      const localTime = (r.local_time || '').slice(0, 5)

      // Check if completed today in the reminder's timezone
      const todayDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(now))

      const isCompletedToday = dailyCompletions.some(
        (c) => c.reminder_id === r.id && c.local_date === todayDate,
      )

      if (recurrence === 'once') {
        if (isCompletedToday || !r.next_fire_at) continue
        const triggerTime = new Date(r.next_fire_at).getTime()
        if (!isNaN(triggerTime) && triggerTime > now + 2000) {
          activeTargets.set(r.id, {
            id: r.id,
            triggerTimeMillis: triggerTime,
            title,
            recurrence: 'once',
            localTime,
            timezone,
            dayOfWeek: r.day_of_week ?? null,
          })
        }
      } else {
        // Recurring: daily, weekdays, weekly
        let candidateTrigger = r.next_fire_at ? new Date(r.next_fire_at).getTime() : NaN
        if (isCompletedToday || isNaN(candidateTrigger) || candidateTrigger <= now) {
        const nextIso = resolveNextFireAt({
          localTime,
          recurrence: recurrence as ReminderRecurrence,
          timezone,
          dayOfWeek: (r.day_of_week as Weekday | null) ?? null,
          now: isCompletedToday ? new Date(now + 86400000) : new Date(now),
        })
          candidateTrigger = new Date(nextIso).getTime()
        }

        if (!isNaN(candidateTrigger) && candidateTrigger > now + 2000) {
          activeTargets.set(r.id, {
            id: r.id,
            triggerTimeMillis: candidateTrigger,
            title,
            recurrence,
            localTime,
            timezone,
            dayOfWeek: r.day_of_week ?? null,
          })
        }
      }
    }

    // 1. Cancel any native alarm that is no longer active
    for (const [reminderId, scheduledItem] of scheduledMap.entries()) {
      if (reminderId === 'test_alarm' || !reminderId) continue
      const active = activeTargets.get(reminderId)
      if (!active) {
        await cancelNativeAlarmById(reminderId)
      } else if (
        Math.abs(scheduledItem.triggerTimeMillis - active.triggerTimeMillis) > 2000 ||
        (scheduledItem.recurrence && scheduledItem.recurrence !== active.recurrence)
      ) {
        await cancelNativeAlarmById(reminderId)
        scheduledMap.delete(reminderId)
      }
    }

    // 2. Schedule any active reminder that isn't currently scheduled
    for (const [reminderId, active] of activeTargets.entries()) {
      if (!scheduledMap.has(reminderId)) {
        await scheduleNativeAlarm({
          reminderId: active.id,
          triggerTimeMillis: active.triggerTimeMillis,
          title: active.title,
          recurrence: active.recurrence,
          localTime: active.localTime,
          timezone: active.timezone,
          dayOfWeek: active.dayOfWeek,
        })
      }
    }
  } catch (err) {
    console.warn('Native alarm reconciliation failed:', err)
  }
}

/**
 * Backward compatibility alias for reconcileNativeAlarms.
 */
export async function reconcileNativeOneTimeAlarms(
  reminders: ReconcileReminderInput[],
  dailyCompletions: ReconcileCompletionInput[] = [],
  notes: Array<{ id: string; title: string }> = [],
): Promise<void> {
  return reconcileNativeAlarms(reminders, dailyCompletions, notes)
}

// Expose on window for physical-device testing via Chrome Remote Debugging (chrome://inspect)
// without polluting production UI or creating permanent UI debug controls.
if (typeof window !== 'undefined') {
  ;(window as unknown as { VaultAlarm?: typeof VaultAlarm }).VaultAlarm = VaultAlarm
}

