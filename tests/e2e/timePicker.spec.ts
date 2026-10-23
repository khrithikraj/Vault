import { expect, test, type Page } from '@playwright/test'
import {
  dragWheel,
  flickWheel,
  openTimeSheet,
  readTime,
  setTime,
  spinWheel,
  tapWheelRow,
  usesTouchTimePicker,
} from './support/timePicker'

/**
 * Time picker — the two surfaces.
 *
 * Desktop keeps the typed control (Hour/Minute fields, steppers, AM/PM).
 * Touch gets a tapped sheet with three scroll wheels — no text field
 * anywhere, so the Gboard never opens over the reminder dialog and a long
 * press can never start a text selection.
 *
 * Each test runs under every Playwright project, so it branches on the
 * viewport width (the same signal the component uses to choose a surface).
 */

async function openDemo(page: Page) {
  page.on('pageerror', (error) => {
    throw error
  })
  await page.addInitScript(() => window.localStorage.setItem('vault:onboardingSeen', '1'))
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Sign-in is unavailable.' })).toBeVisible({
    timeout: 15_000,
  })
  await page.getByRole('button', { name: 'Open demo' }).click()
  await expect(page.getByRole('heading', { name: 'All items' })).toBeVisible({ timeout: 15_000 })
}

/** Opens the standalone reminder editor, which owns the only picker on screen. */
async function openReminderEditor(page: Page) {
  await page.getByRole('button', { name: 'Add item' }).click()
  await page.getByRole('menuitem', { name: /Reminder/i }).click()
  const dialog = page.getByRole('dialog', { name: 'New Reminder' })
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  return dialog
}

test('the time picker uses the surface that matches the device', async ({ page }) => {
  await openDemo(page)
  const dialog = await openReminderEditor(page)

  if (usesTouchTimePicker(page)) {
    // Touch: no text field at all — the Gboard can never open over the dialog.
    await expect(dialog.getByRole('textbox', { name: 'Hour' })).toHaveCount(0)
    await expect(dialog.getByRole('textbox', { name: 'Minute' })).toHaveCount(0)
    await expect(dialog.getByTestId('reminder-time-trigger')).toBeVisible()
  } else {
    // Desktop: the typed control is still there, untouched.
    await expect(dialog.getByRole('textbox', { name: 'Hour' })).toBeVisible()
    await expect(dialog.getByRole('textbox', { name: 'Minute' })).toBeVisible()
    await expect(dialog.getByTestId('reminder-time-trigger')).toBeVisible()
  }
})

test('the tapped sheet is a set of scroll wheels', async ({ page }) => {
  test.skip(!usesTouchTimePicker(page), 'The tapped sheet only exists on touch layouts')
  await openDemo(page)
  const dialog = await openReminderEditor(page)

  const sheet = await openTimeSheet(page, dialog)

  // Three wheels, each a spinbutton that announces its value.
  for (const [testId, label] of [
    ['reminder-time-hour-wheel', 'Hour'],
    ['reminder-time-minute-wheel', 'Minute'],
    ['reminder-time-period-wheel', 'Period'],
  ]) {
    const wheel = sheet.getByTestId(testId)
    await expect(wheel).toBeVisible()
    await expect(wheel).toHaveAttribute('role', 'spinbutton')
    await expect(wheel).toHaveAttribute('aria-label', label)
    await expect(wheel).toHaveAttribute('aria-valuenow', /\d+/)
  }

  // The old tap grids are gone.
  await expect(sheet.getByTestId('reminder-time-hour-grid')).toHaveCount(0)
  await expect(sheet.getByTestId('reminder-time-minute-grid')).toHaveCount(0)
})

test('a tapped time is committed and shown on the trigger', async ({ page }) => {
  await openDemo(page)
  const dialog = await openReminderEditor(page)

  await setTime(page, dialog, 7, 15, 'PM')
  await expect(dialog.getByTestId('reminder-time-trigger')).toContainText('07:15 PM')
  await expect(dialog.getByText('07:15 PM')).toBeVisible()
})

test('the tapped sheet never commits an unconfirmed time', async ({ page }) => {
  test.skip(!usesTouchTimePicker(page), 'The tapped sheet only exists on touch layouts')
  await openDemo(page)
  const dialog = await openReminderEditor(page)

  await setTime(page, dialog, 7, 15, 'PM')
  await expect(dialog.getByTestId('reminder-time-trigger')).toContainText('07:15 PM')

  // Cancel discards the draft.
  let sheet = await openTimeSheet(page, dialog)
  await spinWheel(sheet.getByTestId('reminder-time-hour-wheel'), 3, 12)
  await sheet.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(sheet).toBeHidden()
  await expect(dialog.getByTestId('reminder-time-trigger')).toContainText('07:15 PM')

  // Escape discards the draft too — and only the sheet closes, not the dialog.
  sheet = await openTimeSheet(page, dialog)
  await spinWheel(sheet.getByTestId('reminder-time-minute-wheel'), 2, 60)
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()
  await expect(dialog).toBeVisible()
  await expect(dialog.getByTestId('reminder-time-trigger')).toContainText('07:15 PM')

  // Tapping the backdrop discards the draft as well.
  sheet = await openTimeSheet(page, dialog)
  await page.getByTestId('reminder-time-sheet-backdrop').click({ position: { x: 10, y: 10 } })
  await expect(sheet).toBeHidden()
  await expect(dialog.getByTestId('reminder-time-trigger')).toContainText('07:15 PM')
})

test('the tapped sheet stays inside the viewport with comfortable targets', async ({ page }) => {
  test.skip(!usesTouchTimePicker(page), 'The tapped sheet only exists on touch layouts')
  await openDemo(page)
  const dialog = await openReminderEditor(page)

  const sheet = await openTimeSheet(page, dialog)

  const sheetBox = await sheet.boundingBox()
  const viewport = page.viewportSize()
  expect(sheetBox).not.toBeNull()
  expect(viewport).not.toBeNull()
  expect(sheetBox!.x).toBeGreaterThanOrEqual(-1)
  expect(sheetBox!.y).toBeGreaterThanOrEqual(-1)
  expect(sheetBox!.x + sheetBox!.width).toBeLessThanOrEqual(viewport!.width + 1)
  expect(sheetBox!.y + sheetBox!.height).toBeLessThanOrEqual(viewport!.height + 1)

  // No horizontal page overflow while the sheet is open.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)

  // Every wheel shows five 44 px rows, so each row is a comfortable target.
  for (const testId of [
    'reminder-time-hour-wheel',
    'reminder-time-minute-wheel',
    'reminder-time-period-wheel',
  ]) {
    const box = await sheet.getByTestId(testId).boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThanOrEqual(5 * 44)
    expect(box!.width).toBeGreaterThanOrEqual(56)
  }

  // The footer actions stay reachable at the bottom of the sheet.
  const confirm = sheet.getByTestId('reminder-time-confirm')
  await expect(confirm).toBeVisible()
  const confirmBox = await confirm.boundingBox()
  expect(confirmBox!.height).toBeGreaterThanOrEqual(40)
  expect(confirmBox!.y + confirmBox!.height).toBeLessThanOrEqual(viewport!.height + 1)

  await sheet.getByRole('button', { name: 'Cancel', exact: true }).click()
})

test('the wheels select a time and commit it', async ({ page }) => {
  test.skip(!usesTouchTimePicker(page), 'The tapped sheet only exists on touch layouts')
  await openDemo(page)
  const dialog = await openReminderEditor(page)

  const sheet = await openTimeSheet(page, dialog)

  const hour = sheet.getByTestId('reminder-time-hour-wheel')
  const minute = sheet.getByTestId('reminder-time-minute-wheel')
  const period = sheet.getByTestId('reminder-time-period-wheel')

  await spinWheel(hour, 10, 12)
  await expect(hour).toHaveAttribute('aria-valuenow', '10')
  await expect(hour).toHaveAttribute('aria-valuetext', '11')

  await spinWheel(minute, 45, 60)
  await expect(minute).toHaveAttribute('aria-valuenow', '45')
  await expect(minute).toHaveAttribute('aria-valuetext', '45')

  await spinWheel(period, 1, 2)
  await expect(period).toHaveAttribute('aria-valuetext', 'PM')

  // The sheet previews exactly what "Set time" will commit.
  await expect(sheet.getByTestId('reminder-time-preview')).toHaveText('11:45 PM')

  await sheet.getByTestId('reminder-time-confirm').click()
  await expect(sheet).toBeHidden()
  await expect(dialog.getByTestId('reminder-time-trigger')).toContainText('11:45 PM')
})

test('a wheel dragged with a finger snaps onto a single value', async ({ page }) => {
  test.skip(!usesTouchTimePicker(page), 'The tapped sheet only exists on touch layouts')
  await openDemo(page)
  const dialog = await openReminderEditor(page)

  const sheet = await openTimeSheet(page, dialog)
  const minute = sheet.getByTestId('reminder-time-minute-wheel')

  // The minute wheel starts on 00.
  await expect(minute).toHaveAttribute('aria-valuenow', '0')

  // Dragging the strip up brings later minutes into the centre band.
  await dragWheel(page, minute, 3)

  await expect(minute).toHaveAttribute('aria-valuenow', '3')
  await expect(minute).toHaveAttribute('aria-valuetext', '03')
  await expect(sheet.getByTestId('reminder-time-preview')).toHaveText('09:03 AM')

  // And back down again.
  await dragWheel(page, minute, -2)
  await expect(minute).toHaveAttribute('aria-valuenow', '1')
  await expect(sheet.getByTestId('reminder-time-preview')).toHaveText('09:01 AM')
})

test('the wheels wrap around the ends of the list', async ({ page }) => {
  test.skip(!usesTouchTimePicker(page), 'The tapped sheet only exists on touch layouts')
  await openDemo(page)
  const dialog = await openReminderEditor(page)

  const sheet = await openTimeSheet(page, dialog)
  const minute = sheet.getByTestId('reminder-time-minute-wheel')

  await expect(minute).toHaveAttribute('aria-valuenow', '0')

  // Dragging down past the top of the list wraps to the last minute.
  await dragWheel(page, minute, -2)
  await expect(minute).toHaveAttribute('aria-valuenow', '58')

  // And the hour wheel wraps from 12 back to 01.
  const hour = sheet.getByTestId('reminder-time-hour-wheel')
  await spinWheel(hour, 11, 12)
  await expect(hour).toHaveAttribute('aria-valuetext', '12')
  await hour.focus()
  await hour.press('ArrowDown')
  await expect(hour).toHaveAttribute('aria-valuetext', '01')
})

test('the AM/PM wheel is a bounded two-state selector', async ({ page }) => {
  test.skip(!usesTouchTimePicker(page), 'The tapped sheet only exists on touch layouts')
  await openDemo(page)
  const dialog = await openReminderEditor(page)
  const sheet = await openTimeSheet(page, dialog)

  const period = sheet.getByTestId('reminder-time-period-wheel')
  const preview = sheet.getByTestId('reminder-time-preview')

  // The draft starts on AM.
  await expect(period).toHaveAttribute('aria-valuetext', 'AM')
  await expect(period).toHaveAttribute('aria-valuenow', '0')
  await expect(preview).toHaveText('09:00 AM')

  // One swipe up swaps AM for PM.
  await dragWheel(page, period, 1)
  await expect(period).toHaveAttribute('aria-valuetext', 'PM')
  await expect(period).toHaveAttribute('aria-valuenow', '1')
  await expect(preview).toHaveText('09:00 PM')

  // Swiping further leaves it on PM — the wheel never alternates back to AM.
  await dragWheel(page, period, 3)
  await expect(period).toHaveAttribute('aria-valuetext', 'PM')
  await expect(preview).toHaveText('09:00 PM')

  // Swiping down returns to AM, the only other state.
  await dragWheel(page, period, -1)
  await expect(period).toHaveAttribute('aria-valuetext', 'AM')
  await expect(preview).toHaveText('09:00 AM')

  // Tapping the visible alternative selects it directly.
  await tapWheelRow(period, 1)
  await expect(period).toHaveAttribute('aria-valuetext', 'PM')
  await expect(preview).toHaveText('09:00 PM')

  // And tapping the option above switches back.
  await tapWheelRow(period, -1)
  await expect(period).toHaveAttribute('aria-valuetext', 'AM')
  await expect(preview).toHaveText('09:00 AM')
})

test('a violent flick on the AM/PM wheel switches the period exactly once', async ({ page }) => {
  test.skip(!usesTouchTimePicker(page), 'The tapped sheet only exists on touch layouts')
  await openDemo(page)
  const dialog = await openReminderEditor(page)
  const sheet = await openTimeSheet(page, dialog)

  const period = sheet.getByTestId('reminder-time-period-wheel')
  await expect(period).toHaveAttribute('aria-valuetext', 'AM')

  // A throw is clipped to the next state; it cannot skip one or alternate.
  await flickWheel(page, period, 4)
  await expect(period).toHaveAttribute('aria-valuetext', 'PM')
  await expect(sheet.getByTestId('reminder-time-preview')).toHaveText('09:00 PM')

  await flickWheel(page, period, -4)
  await expect(period).toHaveAttribute('aria-valuetext', 'AM')
  await expect(sheet.getByTestId('reminder-time-preview')).toHaveText('09:00 AM')
})

test('switching the period leaves the hour and minute alone', async ({ page }) => {
  test.skip(!usesTouchTimePicker(page), 'The tapped sheet only exists on touch layouts')
  await openDemo(page)
  const dialog = await openReminderEditor(page)
  const sheet = await openTimeSheet(page, dialog)

  const hour = sheet.getByTestId('reminder-time-hour-wheel')
  const minute = sheet.getByTestId('reminder-time-minute-wheel')
  const period = sheet.getByTestId('reminder-time-period-wheel')

  await spinWheel(hour, 10, 12)
  await spinWheel(minute, 57, 60)
  await expect(sheet.getByTestId('reminder-time-preview')).toHaveText('11:57 AM')

  await tapWheelRow(period, 1)
  await expect(period).toHaveAttribute('aria-valuetext', 'PM')
  await expect(hour).toHaveAttribute('aria-valuetext', '11')
  await expect(minute).toHaveAttribute('aria-valuetext', '57')
  await expect(sheet.getByTestId('reminder-time-preview')).toHaveText('11:57 PM')

  // Set time commits the 24-hour value behind the 12-hour label.
  await sheet.getByTestId('reminder-time-confirm').click()
  await expect(sheet).toBeHidden()
  await expect(dialog.getByTestId('reminder-time-trigger')).toContainText('11:57 PM')
})

test('a saved PM time is loaded back into the period wheel', async ({ page }) => {
  await openDemo(page)
  const dialog = await openReminderEditor(page)

  await setTime(page, dialog, 11, 57, 'PM')
  await dialog.getByPlaceholder(/Renew car insurance/i).fill('Night check')
  await dialog.getByRole('button', { name: 'Create Reminder' }).click()
  await expect(dialog).toBeHidden()

  await page.getByRole('button', { name: /Edit reminder Night check/i }).click()
  const reopened = page.getByRole('dialog', { name: 'Edit Reminder' })
  await expect(reopened).toBeVisible()
  expect(await readTime(reopened)).toBe('11:57 PM')

  if (usesTouchTimePicker(page)) {
    const sheet = await openTimeSheet(page, reopened)
    const period = sheet.getByTestId('reminder-time-period-wheel')
    await expect(period).toHaveAttribute('aria-valuetext', 'PM')
    await expect(period).toHaveAttribute('aria-valuenow', '1')
    await expect(sheet.getByTestId('reminder-time-preview')).toHaveText('11:57 PM')
    await sheet.getByRole('button', { name: 'Cancel', exact: true }).click()
  }
})

test('the typed control still commits a typed time on desktop', async ({ page }) => {
  test.skip(usesTouchTimePicker(page), 'The typed control only exists on desktop layouts')
  await openDemo(page)
  const dialog = await openReminderEditor(page)

  await dialog.getByRole('textbox', { name: 'Hour' }).fill('08')
  await dialog.getByRole('textbox', { name: 'Minute' }).fill('05')
  await expect(dialog.getByTestId('reminder-time-trigger')).toContainText('08:05 AM')

  // The steppers move the value in both directions.
  await dialog.getByRole('button', { name: 'Increase hour' }).click()
  await expect(dialog.getByTestId('reminder-time-trigger')).toContainText('09:05 AM')
  await dialog.getByRole('button', { name: 'Increase minute' }).click()
  await expect(dialog.getByTestId('reminder-time-trigger')).toContainText('09:06 AM')

  await dialog.getByRole('button', { name: 'PM', exact: true }).click()
  await expect(dialog.getByTestId('reminder-time-trigger')).toContainText('09:06 PM')
})

test('the picked time survives a save and reopen', async ({ page }) => {
  await openDemo(page)
  const dialog = await openReminderEditor(page)

  await setTime(page, dialog, 6, 45, 'AM')
  await dialog.getByPlaceholder(/Renew car insurance/i).fill('Time keeper')
  await dialog.getByRole('button', { name: 'Create Reminder' }).click()
  await expect(dialog).toBeHidden()

  await page.getByRole('button', { name: /Edit reminder Time keeper/i }).click()
  const reopened = page.getByRole('dialog', { name: 'Edit Reminder' })
  await expect(reopened).toBeVisible()
  expect(await readTime(reopened)).toBe('06:45 AM')
})
