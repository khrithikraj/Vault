import { describe, expect, it, vi } from 'vitest'
import {
  fetchReminderRows,
  isMissingWeekdaysColumnError,
  REMINDER_SELECT_LEGACY,
  REMINDER_SELECT_WITH_WEEKDAYS,
} from '../../supabase/functions/send-reminders/reminderQuery'

describe('reminder query schema compatibility', () => {
  it('identifies only missing-weekdays column errors', () => {
    expect(isMissingWeekdaysColumnError({ code: '42703', message: 'column weekdays does not exist' })).toBe(true)
    expect(isMissingWeekdaysColumnError({ code: '42703', message: 'column fire_on_date does not exist' })).toBe(false)
    expect(isMissingWeekdaysColumnError({ message: 'column reminders.weekdays does not exist' })).toBe(true)
    expect(isMissingWeekdaysColumnError({ code: '42P01', message: 'relation does not exist' })).toBe(false)
    expect(isMissingWeekdaysColumnError({ message: 'permission denied' })).toBe(false)
  })

  it('uses the new-schema select without retrying when it succeeds', async () => {
    const load = vi.fn(async (selection: string) => ({ data: [{ selection }], error: null }))
    await expect(fetchReminderRows(load)).resolves.toEqual({
      data: [{ selection: REMINDER_SELECT_WITH_WEEKDAYS }],
      error: null,
    })
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('retries with the legacy select only for a missing weekdays column', async () => {
    const load = vi.fn()
      .mockResolvedValueOnce({ data: null, error: { code: '42703', message: 'column weekdays does not exist' } })
      .mockResolvedValueOnce({ data: [{ id: 'legacy' }], error: null })
    await expect(fetchReminderRows(load)).resolves.toEqual({
      data: [{ id: 'legacy' }],
      error: null,
    })
    expect(load).toHaveBeenNthCalledWith(1, REMINDER_SELECT_WITH_WEEKDAYS)
    expect(load).toHaveBeenNthCalledWith(2, REMINDER_SELECT_LEGACY)
  })

  it('does not retry unrelated database errors', async () => {
    const error = { code: '42501', message: 'permission denied' }
    const load = vi.fn().mockResolvedValue({ data: null, error })
    await expect(fetchReminderRows(load)).resolves.toEqual({ data: null, error })
    expect(load).toHaveBeenCalledTimes(1)
  })
})
