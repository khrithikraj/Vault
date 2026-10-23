import { expect, type Locator, type Page } from '@playwright/test'

/**
 * Time picker test helpers.
 *
 * The picker renders one of two surfaces, chosen by the component from
 * `(max-width: 639px), (pointer: coarse)`:
 *
 *  • **typed**  — desktop: Hour/Minute text fields plus steppers and AM/PM.
 *  • **tapped** — touch: a sheet with hour, minute and AM/PM scroll wheels.
 *
 * Every Playwright project is either narrower than 640 px (mobile) or wider
 * (desktop), so the viewport width is a deterministic mirror of that decision
 * and lets one spec drive both surfaces.
 */

export const TOUCH_BREAKPOINT = 640

export function usesTouchTimePicker(page: Page): boolean {
  const viewport = page.viewportSize()
  return (viewport?.width ?? 0) < TOUCH_BREAKPOINT
}

export function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/** Opens the tapped time sheet and returns its locator. */
export async function openTimeSheet(page: Page, scope: Locator): Promise<Locator> {
  await scope.getByTestId('reminder-time-trigger').click()
  const sheet = page.getByRole('dialog', { name: 'Choose time' })
  await expect(sheet).toBeVisible()
  return sheet
}

/**
 * Spins a wheel onto an exact row with the keyboard.
 *
 * The wheels are spinbuttons, so arrow keys move them a row at a time and
 * Home/End jump to the ends of the list. Taking the short way round the ring
 * keeps the number of key presses bounded (at most half the list).
 */
export async function spinWheel(wheel: Locator, targetIndex: number, size: number): Promise<void> {
  await wheel.focus()
  const current = Number(await wheel.getAttribute('aria-valuenow'))

  if (targetIndex - current > size / 2) {
    await wheel.press('End')
    for (let step = 0; step < size - 1 - targetIndex; step += 1) await wheel.press('ArrowUp')
    return
  }
  if (current - targetIndex > size / 2) {
    await wheel.press('Home')
    for (let step = 0; step < targetIndex; step += 1) await wheel.press('ArrowDown')
    return
  }

  const delta = targetIndex - current
  const key = delta > 0 ? 'ArrowDown' : 'ArrowUp'
  for (let step = 0; step < Math.abs(delta); step += 1) await wheel.press(key)
}

/**
 * Drags a wheel with a real pointer gesture.
 *
 * The drag is slow enough that the throw is treated as a deliberate release,
 * so the wheel lands on exactly the rows the gesture covered.
 */
export async function dragWheel(
  page: Page,
  wheel: Locator,
  rows: number,
  rowHeight = 44,
): Promise<void> {
  const box = await wheel.boundingBox()
  if (!box) throw new Error('the wheel has no layout box')
  const x = box.x + box.width / 2
  const startY = box.y + box.height / 2
  const endY = startY - rows * rowHeight

  await page.mouse.move(x, startY)
  await page.mouse.down()
  const steps = 8
  for (let step = 1; step <= steps; step += 1) {
    await page.mouse.move(x, startY + ((endY - startY) * step) / steps)
    await page.waitForTimeout(30)
  }
  // Let the gesture come to rest so releasing does not add a throw.
  await page.waitForTimeout(150)
  await page.mouse.up()
}

/**
 * Taps a single row of a wheel.
 *
 * `row` is the distance from the centre band in rows: 0 is the selected row,
 * 1 the row below it and -1 the row above it. A bounded wheel (the AM/PM
 * column) answers a tap by selecting the row that was tapped.
 */
export async function tapWheelRow(wheel: Locator, row: number, rowHeight = 44): Promise<void> {
  const box = await wheel.boundingBox()
  if (!box) throw new Error('the wheel has no layout box')
  await wheel.click({
    position: {
      x: box.width / 2,
      y: box.height / 2 + row * rowHeight,
    },
  })
}

/**
 * Flicks a wheel with a fast, uninterrupted gesture.
 *
 * The pointer never comes to rest, so the wheel sees a throw and projects it
 * forward — the gesture a violent swipe produces.
 */
export async function flickWheel(
  page: Page,
  wheel: Locator,
  rows: number,
  rowHeight = 44,
): Promise<void> {
  const box = await wheel.boundingBox()
  if (!box) throw new Error('the wheel has no layout box')
  const x = box.x + box.width / 2
  const startY = box.y + box.height / 2
  const endY = startY - rows * rowHeight

  await page.mouse.move(x, startY)
  await page.mouse.down()
  const steps = 4
  for (let step = 1; step <= steps; step += 1) {
    await page.mouse.move(x, startY + ((endY - startY) * step) / steps)
  }
  await page.mouse.up()
}

/**
 * Picks a time through whichever surface is active and leaves it committed.
 *
 * `scope` is the dialog that owns the picker — the trigger lives inside it,
 * while the sheet is portaled to the document body.
 */
export async function setTime(
  page: Page,
  scope: Locator,
  hour: number,
  minute: number,
  period: 'AM' | 'PM' = 'AM',
): Promise<void> {
  if (usesTouchTimePicker(page)) {
    const sheet = await openTimeSheet(page, scope)
    await spinWheel(sheet.getByTestId('reminder-time-hour-wheel'), hour - 1, 12)
    await spinWheel(sheet.getByTestId('reminder-time-minute-wheel'), minute, 60)
    await spinWheel(sheet.getByTestId('reminder-time-period-wheel'), period === 'AM' ? 0 : 1, 2)
    await sheet.getByTestId('reminder-time-confirm').click()
    await expect(sheet).toBeHidden()
    return
  }

  await scope.getByRole('textbox', { name: 'Hour' }).fill(pad2(hour))
  await scope.getByRole('textbox', { name: 'Minute' }).fill(pad2(minute))
  await scope.getByRole('button', { name: period, exact: true }).click()
}

/** Reads the time currently shown by the picker, in "hh:mm AM" form. */
export async function readTime(scope: Locator): Promise<string | null> {
  const text = await scope.getByTestId('reminder-time-trigger').textContent()
  if (!text) return null
  const match = text.match(/(\d{2}:\d{2}\s(?:AM|PM))/)
  return match ? match[1] : null
}
