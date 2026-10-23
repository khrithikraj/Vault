import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TIME_DRAFT,
  formatReminderTime,
  stepHour12,
  stepMinute,
  timeDraftFromValue,
  timeDraftToValue,
  to24HourTime,
  validateReminderTime,
} from '../../src/lib/reminders'
import {
  wheelBoundedAdvance,
  wheelBoundedAnchor,
  wheelBoundedIndex,
  wheelBoundedOffset,
  wheelCentreIndex,
  wheelClamp,
  wheelFlingAdvance,
  wheelMod,
  wheelRingDelta,
} from '../../src/lib/timeWheel'

/**
 * Time picker — pure time-draft rules.
 *
 * The picker has two surfaces (typed on desktop, tapped on mobile) that share
 * one value contract: a canonical 24-hour "HH:MM" string. These tests pin the
 * rules both surfaces rely on so a change to one can never change the other.
 */

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))

function read(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), 'utf8')
}

describe('time draft', () => {
  it('reads a committed value into a 12-hour draft', () => {
    expect(timeDraftFromValue('09:46')).toEqual({ hour12: 9, minute: 46, period: 'AM' })
    expect(timeDraftFromValue('13:05')).toEqual({ hour12: 1, minute: 5, period: 'PM' })
    expect(timeDraftFromValue('00:30')).toEqual({ hour12: 12, minute: 30, period: 'AM' })
    expect(timeDraftFromValue('12:00')).toEqual({ hour12: 12, minute: 0, period: 'PM' })
  })

  it('falls back to the default draft for an empty or invalid value', () => {
    expect(timeDraftFromValue('')).toEqual(DEFAULT_TIME_DRAFT)
    expect(timeDraftFromValue('99:99')).toEqual(DEFAULT_TIME_DRAFT)
    expect(timeDraftFromValue('not-a-time')).toEqual(DEFAULT_TIME_DRAFT)
  })

  it('commits a draft back to the canonical 24-hour format', () => {
    expect(timeDraftToValue({ hour12: 9, minute: 46, period: 'AM' })).toBe('09:46')
    expect(timeDraftToValue({ hour12: 12, minute: 0, period: 'AM' })).toBe('00:00')
    expect(timeDraftToValue({ hour12: 12, minute: 0, period: 'PM' })).toBe('12:00')
    expect(timeDraftToValue({ hour12: 1, minute: 5, period: 'PM' })).toBe('13:05')
  })

  it('round-trips every valid hour and minute through the draft', () => {
    for (let hour24 = 0; hour24 < 24; hour24++) {
      for (const minute of [0, 1, 7, 30, 59]) {
        const value = `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
        expect(timeDraftToValue(timeDraftFromValue(value))).toBe(value)
      }
    }
  })

  it('keeps the committed value a valid reminder time', () => {
    for (let hour24 = 0; hour24 < 24; hour24++) {
      for (const minute of [0, 15, 45, 59]) {
        const value = timeDraftToValue(
          timeDraftFromValue(`${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`),
        )
        expect(validateReminderTime(value)).toBe(true)
      }
    }
  })

  it('clamps out-of-range draft values instead of producing an invalid time', () => {
    expect(timeDraftToValue({ hour12: 0, minute: 0, period: 'AM' })).toBe('01:00')
    expect(timeDraftToValue({ hour12: 13, minute: 0, period: 'PM' })).toBe('12:00')
    expect(timeDraftToValue({ hour12: 9, minute: 75, period: 'AM' })).toBe('09:59')
    expect(timeDraftToValue({ hour12: 9, minute: -5, period: 'AM' })).toBe('09:00')
  })
})

describe('stepping', () => {
  it('wraps the 12-hour clock in both directions', () => {
    expect(stepHour12(9, 1)).toBe(10)
    expect(stepHour12(9, -1)).toBe(8)
    expect(stepHour12(12, 1)).toBe(1)
    expect(stepHour12(1, -1)).toBe(12)
    expect(stepHour12(12, -1)).toBe(11)
  })

  it('wraps minutes in both directions', () => {
    expect(stepMinute(0, 1)).toBe(1)
    expect(stepMinute(59, 1)).toBe(0)
    expect(stepMinute(0, -1)).toBe(59)
    expect(stepMinute(30, -1)).toBe(29)
  })

  it('never produces an out-of-range value', () => {
    for (let hour = 1; hour <= 12; hour++) {
      for (const delta of [-2, -1, 0, 1, 2]) {
        const stepped = stepHour12(hour, delta)
        expect(stepped).toBeGreaterThanOrEqual(1)
        expect(stepped).toBeLessThanOrEqual(12)
      }
    }
    for (let minute = 0; minute < 60; minute++) {
      for (const delta of [-2, -1, 0, 1, 2]) {
        const stepped = stepMinute(minute, delta)
        expect(stepped).toBeGreaterThanOrEqual(0)
        expect(stepped).toBeLessThanOrEqual(59)
      }
    }
  })
})

describe('display format is unchanged', () => {
  it('still renders the reminder time as a 12-hour label', () => {
    expect(formatReminderTime('09:46')).toBe('09:46 AM')
    expect(formatReminderTime('13:05')).toBe('01:05 PM')
    expect(formatReminderTime('00:30')).toBe('12:30 AM')
    expect(formatReminderTime('12:00')).toBe('12:00 PM')
  })
})

/**
 * Source contract for the two picker surfaces.
 *
 * The Gboard problem cannot be reproduced in a headless browser, so the guard
 * is structural: the touch surface must not contain a text input at all, and
 * the typed surface must keep its Hour/Minute textboxes for desktop.
 */
describe('picker surfaces', () => {
  const source = read('src/components/ui/CustomTimePicker.tsx')

  it('keeps the typed hour and minute textboxes for desktop', () => {
    expect(source).toContain('aria-label="Hour"')
    expect(source).toContain('aria-label="Minute"')
    expect(source).toContain('inputMode="numeric"')
  })

  it('gives the touch surface no text input', () => {
    // Everything between the touch surface and the end of the file is the
    // tapped picker; it must not declare an <input> of any kind.
    const touchSurface = source.slice(source.indexOf('function TouchTimePicker'))
    expect(touchSurface).not.toMatch(/<input/)
    expect(touchSurface).not.toMatch(/inputMode=/)
  })

  it('exposes the touch trigger and a confirm action', () => {
    expect(source).toContain('data-testid="reminder-time-trigger"')
    expect(source).toContain('data-testid="reminder-time-confirm"')
    expect(source).toContain('aria-haspopup="dialog"')
  })

  it('switches to the touch surface on a coarse pointer or a narrow viewport', () => {
    expect(source).toContain('(max-width: 639px), (pointer: coarse)')
  })

  it('suppresses text selection on the touch surface', () => {
    expect(source).toContain('select-none')
    expect(source).toContain('touch-manipulation')
  })

  it('drives the touch surface with three scroll wheels instead of grids', () => {
    expect(source).toContain('<TimeWheel')
    expect(source).toContain('testId="reminder-time-hour-wheel"')
    expect(source).toContain('testId="reminder-time-minute-wheel"')
    expect(source).toContain('testId="reminder-time-period-wheel"')
    expect(source).not.toContain('reminder-time-hour-grid')
    expect(source).not.toContain('reminder-time-minute-grid')
  })

  it('bounds only the period wheel and leaves the hour and minute wheels cyclic', () => {
    const wheels = source.split('<TimeWheel').slice(1)
    const hour = wheels.find((block) => block.includes('reminder-time-hour-wheel'))
    const minute = wheels.find((block) => block.includes('reminder-time-minute-wheel'))
    const period = wheels.find((block) => block.includes('reminder-time-period-wheel'))

    expect(hour).toBeDefined()
    expect(minute).toBeDefined()
    expect(period).toBeDefined()

    // The hour and minute wheels keep wrapping around their ends.
    expect(hour).not.toContain('bounded')
    expect(minute).not.toContain('bounded')
    // The AM/PM wheel has only two states, so it must not wrap.
    expect(period).toContain('bounded')
  })

  it('offers the AM/PM wheel exactly the two valid periods', () => {
    expect(source).toContain("{ value: 'AM', label: 'AM' }")
    expect(source).toContain("{ value: 'PM', label: 'PM' }")
  })
})

/**
 * Source contract for the scroll wheel itself.
 *
 * The wheel is the whole touch experience, so the properties that make it
 * usable on a phone are pinned here: it is a real wheel (not a grid), it never
 * hands the gesture to the page, it can be operated without a finger, and it
 * announces its value to assistive technology.
 */
describe('scroll wheel surface', () => {
  const wheel = read('src/components/ui/TimeWheel.tsx')

  it('is a pointer-driven wheel, not a scrollable grid', () => {
    expect(wheel).toContain('onPointerDown')
    expect(wheel).toContain('onPointerMove')
    expect(wheel).toContain('setPointerCapture')
    expect(wheel).not.toContain('overflow-y-auto')
  })

  it('never lets a wheel gesture scroll the page behind it', () => {
    expect(wheel).toContain('touch-none')
    expect(wheel).toContain('overscroll-contain')
  })

  it('exposes the value as a spinbutton for keyboards and screen readers', () => {
    expect(wheel).toContain('role="spinbutton"')
    expect(wheel).toContain('aria-valuenow')
    expect(wheel).toContain('aria-valuetext')
    expect(wheel).toContain('aria-label={label}')
    expect(wheel).toContain('ArrowUp')
    expect(wheel).toContain('ArrowDown')
  })

  it('snaps the strip onto a single row after a throw', () => {
    expect(wheel).toContain('wheelFlingAdvance')
    expect(wheel).toContain('requestAnimationFrame')
  })
})

/**
 * The wheel maths.
 *
 * These are the rules that make the wheels feel right: the strip follows the
 * finger exactly, a throw is projected forward and clamped, the wheel wraps
 * around the ends of the list, and the value always lands on a single row.
 */
describe('scroll wheel maths', () => {
  const ITEM = 44

  it('frames the anchor row when the strip is at rest', () => {
    expect(wheelCentreIndex(7, 0, ITEM)).toBe(7)
  })

  it('follows the finger one row per row of travel', () => {
    // Dragging the strip down by one row brings an earlier row into the band.
    expect(wheelCentreIndex(7, ITEM, ITEM)).toBe(6)
    expect(wheelCentreIndex(7, -ITEM, ITEM)).toBe(8)
    // Half a row is halfway between two rows.
    expect(wheelCentreIndex(7, ITEM / 2, ITEM)).toBe(6.5)
  })

  it('wraps a negative anchor back onto the item list', () => {
    expect(wheelMod(-1, 12)).toBe(11)
    expect(wheelMod(12, 12)).toBe(0)
    expect(wheelMod(-60, 60)).toBe(0)
    expect(wheelMod(0, 0)).toBe(0)
  })

  it('lands on a single whole row after a drag', () => {
    // A quarter-row drag snaps back to the row it started on.
    expect(
      wheelFlingAdvance({
        offset: -ITEM / 4,
        velocity: 0,
        itemHeight: ITEM,
        projectionMs: 120,
        maxRows: 8,
      }),
    ).toBe(0)
    // A half-row drag snaps to the next row.
    expect(
      wheelFlingAdvance({
        offset: -ITEM / 2,
        velocity: 0,
        itemHeight: ITEM,
        projectionMs: 120,
        maxRows: 8,
      }),
    ).toBe(1)
  })

  it('projects a throw forward in the direction of the flick', () => {
    // The finger moves up (negative velocity), so later rows come into view.
    expect(
      wheelFlingAdvance({
        offset: 0,
        velocity: -1,
        itemHeight: ITEM,
        projectionMs: 100,
        maxRows: 8,
      }),
    ).toBe(2)
    // And the other way round for a downward flick.
    expect(
      wheelFlingAdvance({
        offset: 0,
        velocity: 1,
        itemHeight: ITEM,
        projectionMs: 100,
        maxRows: 8,
      }),
    ).toBe(-2)
  })

  it('clamps a violent flick to a bounded number of rows', () => {
    expect(
      wheelFlingAdvance({
        offset: 0,
        velocity: -50,
        itemHeight: ITEM,
        projectionMs: 120,
        maxRows: 8,
      }),
    ).toBe(8)
    expect(
      wheelFlingAdvance({
        offset: 0,
        velocity: 50,
        itemHeight: ITEM,
        projectionMs: 120,
        maxRows: 8,
      }),
    ).toBe(-8)
  })

  it('takes the short way around the ring for Home and End', () => {
    // 59 minutes is one step backwards from 00, not 59 steps forwards.
    expect(wheelRingDelta(0, 59, 60)).toBe(-1)
    expect(wheelRingDelta(59, 0, 60)).toBe(1)
    expect(wheelRingDelta(0, 11, 12)).toBe(-1)
    expect(wheelRingDelta(3, 3, 12)).toBe(0)
    expect(wheelRingDelta(0, 6, 12)).toBe(6)
  })
})

/**
 * The bounded wheel — AM/PM as a two-state selector.
 *
 * A cyclic wheel folds every visible row back into its item list, so a
 * two-item column renders an endless `AM, PM, AM, PM …` strip and a drag just
 * slides one more item of that alternation into the band. A bounded wheel
 * clips instead: the anchor stays on a real item, the strip stops at the end
 * of the list and a throw advances it by at most one state.
 *
 * The simulation below drives exactly the pure helpers the component uses,
 * so the rules pinned here are the rules the wheel actually runs on.
 */
describe('bounded wheel maths', () => {
  const ITEM = 44
  const SIZE = 2 // AM, PM

  /** The wheel's resting state: an anchor on a real item and no offset. */
  type BoundedState = { anchor: number; offset: number }

  /** The state a bounded wheel starts in for a given period. */
  function resting(period: 'AM' | 'PM'): BoundedState {
    return { anchor: period === 'AM' ? 0 : 1, offset: 0 }
  }

  /** A drag: the strip follows the finger but stops at the end of the list. */
  function drag(state: BoundedState, deltaPx: number): BoundedState {
    return {
      anchor: state.anchor,
      offset: wheelBoundedOffset(state.anchor, state.offset + deltaPx, ITEM, SIZE),
    }
  }

  /** The period the centre band frames. */
  function periodOf(state: BoundedState): 'AM' | 'PM' {
    return wheelBoundedIndex(state.anchor, state.offset, ITEM, SIZE) === 0 ? 'AM' : 'PM'
  }

  /** Releasing a drag: the throw is projected forward and clipped to the list. */
  function release(state: BoundedState, velocity = 0): BoundedState {
    const raw = wheelFlingAdvance({
      offset: state.offset,
      velocity,
      itemHeight: ITEM,
      projectionMs: 120,
      maxRows: 8,
    })
    const advance = wheelBoundedAdvance(state.anchor, raw, SIZE)
    return { anchor: wheelBoundedAnchor(state.anchor + advance, SIZE), offset: 0 }
  }

  /** The rows a bounded wheel renders, mirroring the component's render loop. */
  function renderedRows(state: BoundedState): number[] {
    const centre = wheelCentreIndex(state.anchor, state.offset, ITEM)
    const base = Math.round(centre)
    const rows: number[] = []
    for (let index = base - 3; index <= base + 3; index += 1) {
      if (index < 0 || index >= SIZE) continue
      rows.push(index)
    }
    return rows
  }

  it('clamps a value into a range', () => {
    expect(wheelClamp(5, 0, 1)).toBe(1)
    expect(wheelClamp(-5, 0, 1)).toBe(0)
    expect(wheelClamp(0, 0, 1)).toBe(0)
  })

  it('keeps the anchor on a real item', () => {
    expect(wheelBoundedAnchor(0, 2)).toBe(0)
    expect(wheelBoundedAnchor(1, 2)).toBe(1)
    expect(wheelBoundedAnchor(2, 2)).toBe(1)
    expect(wheelBoundedAnchor(-1, 2)).toBe(0)
    expect(wheelBoundedAnchor(99, 2)).toBe(1)
  })

  it('switches AM to PM', () => {
    const dragged = drag(resting('AM'), -ITEM)
    expect(periodOf(dragged)).toBe('PM')
    expect(periodOf(release(dragged))).toBe('PM')
  })

  it('switches PM to AM', () => {
    const dragged = drag(resting('PM'), ITEM)
    expect(periodOf(dragged)).toBe('AM')
    expect(periodOf(release(dragged))).toBe('AM')
  })

  it('switches only once the drag passes the halfway point', () => {
    expect(periodOf(drag(resting('AM'), -ITEM / 4))).toBe('AM')
    expect(periodOf(drag(resting('AM'), -ITEM / 2))).toBe('PM')
  })

  it('never cycles infinitely', () => {
    // Any number of swipes in the same direction leaves the wheel on the
    // last period — it can never alternate AM, PM, AM, PM.
    let state = resting('AM')
    for (let swipe = 0; swipe < 25; swipe += 1) {
      state = release(drag(state, -ITEM * 3))
      expect(periodOf(state)).toBe('PM')
    }

    state = resting('PM')
    for (let swipe = 0; swipe < 25; swipe += 1) {
      state = release(drag(state, ITEM * 3))
      expect(periodOf(state)).toBe('AM')
    }
  })

  it('never renders an endless alternating sequence', () => {
    // The strip shows each period exactly once: the selected one in the band
    // and the other one as the adjacent option. Only the offsets a bounded
    // wheel can actually reach are considered.
    for (const period of ['AM', 'PM'] as const) {
      const anchor = resting(period).anchor
      const min = wheelBoundedOffset(anchor, -ITEM * 10, ITEM, SIZE)
      const max = wheelBoundedOffset(anchor, ITEM * 10, ITEM, SIZE)
      for (let offset = min; offset <= max; offset += 1) {
        const rows = renderedRows({ anchor, offset })
        expect(rows).toEqual([0, 1])
        expect(new Set(rows).size).toBe(rows.length)
      }
    }
  })

  it('keeps the selected period in the centre band', () => {
    for (const period of ['AM', 'PM'] as const) {
      const state = resting(period)
      expect(wheelBoundedIndex(state.anchor, state.offset, ITEM, SIZE)).toBe(
        period === 'AM' ? 0 : 1,
      )
      // And while the strip is being dragged within its range.
      for (let offset = -ITEM; offset <= ITEM; offset += 1) {
        const index = wheelBoundedIndex(state.anchor, offset, ITEM, SIZE)
        expect(index).toBeGreaterThanOrEqual(0)
        expect(index).toBeLessThanOrEqual(1)
      }
    }
  })

  it('does not toggle more than once per gesture', () => {
    // A violent flick is clipped to a single state change.
    const flicked = release(drag(resting('AM'), -4), -4)
    expect(periodOf(flicked)).toBe('PM')

    const back = release(drag(flicked, ITEM * 5), 4)
    expect(periodOf(back)).toBe('AM')

    // And a flick in the same direction again does nothing at all.
    expect(periodOf(release(drag(flicked, -ITEM * 5), -4))).toBe('PM')
  })

  it('stops at the ends of the list instead of wrapping', () => {
    // Dragging past the end of the list cannot move the strip further.
    const past = drag(resting('AM'), -ITEM * 10)
    expect(past.offset).toBe(-ITEM)
    expect(periodOf(past)).toBe('PM')

    const before = drag(resting('PM'), ITEM * 10)
    expect(before.offset).toBe(ITEM)
    expect(periodOf(before)).toBe('AM')
  })

  it('leaves the cyclic wheels untouched', () => {
    // The hour and minute wheels still fold every row back into their list.
    expect(wheelMod(-1, 12)).toBe(11)
    expect(wheelMod(12, 12)).toBe(0)
    expect(wheelFlingAdvance({
      offset: 0,
      velocity: -1,
      itemHeight: ITEM,
      projectionMs: 100,
      maxRows: 8,
    })).toBe(2)
  })
})

/**
 * The period value contract.
 *
 * Switching the period must move the period and nothing else: the hour and
 * the minute the user chose survive the switch, and the committed value stays
 * a canonical 24-hour "HH:MM" string.
 */
describe('period switching keeps the time intact', () => {
  it('converts 11:57 PM to the right canonical value and label', () => {
    const draft = { hour12: 11, minute: 57, period: 'PM' as const }
    expect(timeDraftToValue(draft)).toBe('23:57')
    expect(formatReminderTime(timeDraftToValue(draft))).toBe('11:57 PM')
  })

  it('changes only the period when AM becomes PM', () => {
    const am = { hour12: 11, minute: 57, period: 'AM' as const }
    const pm = { hour12: 11, minute: 57, period: 'PM' as const }
    expect(timeDraftToValue(am)).toBe('11:57')
    expect(timeDraftToValue(pm)).toBe('23:57')
    expect(formatReminderTime(timeDraftToValue(am))).toBe('11:57 AM')
    expect(formatReminderTime(timeDraftToValue(pm))).toBe('11:57 PM')
  })

  it('keeps the 12 o’clock conversion correct in both directions', () => {
    expect(timeDraftToValue({ hour12: 12, minute: 0, period: 'AM' })).toBe('00:00')
    expect(timeDraftToValue({ hour12: 12, minute: 0, period: 'PM' })).toBe('12:00')
    expect(formatReminderTime('00:00')).toBe('12:00 AM')
    expect(formatReminderTime('12:00')).toBe('12:00 PM')
    expect(to24HourTime(12, 30, 'AM')).toBe('00:30')
    expect(to24HourTime(12, 30, 'PM')).toBe('12:30')
  })

  it('round-trips a saved time back into the same period', () => {
    expect(timeDraftFromValue('23:57')).toEqual({ hour12: 11, minute: 57, period: 'PM' })
    expect(timeDraftFromValue('11:57')).toEqual({ hour12: 11, minute: 57, period: 'AM' })
  })
})
