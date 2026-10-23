import { expect, test, type Locator, type Page } from '@playwright/test'
import { setTime, usesTouchTimePicker } from './support/timePicker'

async function expectDialogContainedInViewport(page: Page, dialog: Locator) {
  await expect
    .poll(
      async () => {
        const box = await dialog.boundingBox()
        const viewport = page.viewportSize()
        if (!box || !viewport) return false
        return (
          box.x >= -1 &&
          box.y >= -1 &&
          box.x + box.width <= viewport.width + 1 &&
          box.y + box.height <= viewport.height + 1
        )
      },
      {
        message: 'Dialog bounding box should be contained within viewport',
        timeout: 10_000,
      },
    )
    .toBe(true)
}

const CALENDAR_VIEWPORTS = [
  { width: 320, height: 780 },
  { width: 360, height: 780 },
  { width: 390, height: 780 },
  { width: 414, height: 780 },
]

async function openDemo(page: Page) {
  page.on('pageerror', (error) => { throw error })
  await page.addInitScript(() => window.localStorage.setItem('vault:onboardingSeen', '1'))
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Sign-in is unavailable.' })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Open demo' }).click()
  await expect(page.getByRole('heading', { name: 'All items' })).toBeVisible({ timeout: 15_000 })
}

test('note and item reminders save, reopen, and persist recurrence via real keystrokes', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`)
  })

  await openDemo(page)
  await page.getByRole('button', { name: 'Notes' }).click()
  await page.getByRole('button', { name: 'Add item' }).click()
  const editor = page.getByRole('dialog', { name: 'Note editor' })

  // ── TEST A — note-level reminder via real typing ────────────────────────────
  const moreActions = editor.getByRole('button', { name: 'More actions', exact: true })
  await moreActions.click()
  await page.getByRole('menuitem', { name: 'Reminder', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Reminder settings' })
  await expect(dialog).toBeVisible()
  await expectDialogContainedInViewport(page, dialog)
  await expect(dialog.getByText('--:-- --')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()

  // Set 09:46 AM — typed on desktop, tapped on touch
  await setTime(page, dialog, 9, 46, 'AM')
  await expect(dialog.getByText('09:46 AM')).toBeVisible({ timeout: 5000 })
  await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeEnabled()

  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).toBeHidden()
  await moreActions.click()
  await expect(page.getByRole('menuitem', { name: /Daily\b.*09:46 AM/i })).toBeVisible({ timeout: 5000 })
  await page.keyboard.press('Escape')

  // Reopen — saved time must be loaded back
  await moreActions.click()
  await page.getByRole('menuitem', { name: /Daily\b.*09:46 AM/i }).click()
  const dialog2 = page.getByRole('dialog', { name: 'Reminder settings' })
  await expect(dialog2).toBeVisible()
  if (usesTouchTimePicker(page)) {
    // The touched surface shows the committed time on its trigger.
    await expect(dialog2.getByTestId('reminder-time-trigger')).toContainText('09:46 AM')
  } else {
    await expect(dialog2.getByRole('textbox', { name: 'Hour' })).toHaveValue('09')
    await expect(dialog2.getByRole('textbox', { name: 'Minute' })).toHaveValue('46')
  }
  await expect(dialog2.getByText('09:46 AM')).toBeVisible()

  // Switch to Weekly + pick a weekday different from today
  const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const todayName = weekdayNames[new Date().getDay()]
  const pick = weekdayNames[(new Date().getDay() + 1) % 7]
  await dialog2.getByRole('button', { name: 'Daily', exact: true }).click()
  await dialog2.getByRole('button', { name: 'Weekly', exact: true }).click()
  await dialog2.getByRole('button', { name: todayName, exact: true }).click()
  await dialog2.getByRole('button', { name: pick, exact: true }).click()
  await dialog2.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog2).toBeHidden()
  await moreActions.click()
  await expect(page.getByRole('menuitem', { name: /Weekly · 09:46 AM/i })).toBeVisible({ timeout: 5000 })
  await page.keyboard.press('Escape')

  // Reopen — weekly + weekday must persist
  await moreActions.click()
  await page.getByRole('menuitem', { name: /Weekly · 09:46 AM/i }).click()
  const dialog3 = page.getByRole('dialog', { name: 'Reminder settings' })
  await expect(dialog3).toBeVisible()
  await expect(dialog3.getByText('Weekly')).toBeVisible()
  await expect(dialog3.getByText('09:46 AM')).toBeVisible()
  await expect(dialog3.getByRole('button', { name: pick, exact: true })).toBeVisible()
  await dialog3.getByRole('button', { name: 'Close' }).click()

  // ── TEST B — item-level reminder via real keystrokes, edit, remove ──────────
  await editor.getByPlaceholder('Add new task or list item...').fill('Tower area')
  await editor.getByRole('button', { name: 'Add', exact: true }).click()

  // The row is compact: the item reminder lives in the row's ⋯ menu.
  const rowMore = editor.getByRole('button', { name: 'More actions for Tower area' })
  await rowMore.click()
  await page.getByRole('menuitem', { name: 'Set reminder' }).click()
  const itemDialog = page.getByRole('dialog', { name: 'Reminder settings' })
  await expect(itemDialog).toBeVisible()
  await expectDialogContainedInViewport(page, itemDialog)

  // The item ReminderControl is the same component instance that held the note's
  // 09:46 AM, so the picker opens pre-filled. setTime drives whichever surface
  // this viewport uses (typed on desktop, tapped on touch).
  await setTime(page, itemDialog, 12, 32, 'PM')
  await expect(itemDialog.getByText('12:32 PM')).toBeVisible({ timeout: 5000 })
  await itemDialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(editor.locator('[title*="reminder at 12:32 PM"]')).toBeVisible({ timeout: 5000 })

  // Edit to 12:46 PM through the row's ⋯ menu
  await rowMore.click()
  await page.getByRole('menuitem', { name: 'Edit reminder' }).click()
  const itemDialog2 = page.getByRole('dialog', { name: 'Reminder settings' })
  await expect(itemDialog2).toBeVisible()
  await setTime(page, itemDialog2, 12, 46, 'PM')
  await expect(itemDialog2.getByText('12:46 PM')).toBeVisible({ timeout: 5000 })
  await itemDialog2.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(editor.locator('[title*="reminder at 12:46 PM"]')).toBeVisible({ timeout: 5000 })

  // Remove
  await rowMore.click()
  await page.getByRole('menuitem', { name: 'Edit reminder' }).click()
  const itemDialog3 = page.getByRole('dialog', { name: 'Reminder settings' })
  await expect(itemDialog3).toBeVisible()
  await itemDialog3.getByRole('button', { name: 'Remove' }).click()
  // Scoped to the checklist rows — the note-level chip also carries "reminder at"
  // in its title, so the assertion must not match the header.
  await expect(editor.locator('ul [title*="reminder at"]')).toHaveCount(0)

  expect(errors).toEqual([])
})

test('a "Once" reminder saves its exact date, hides it for repeating modes, and restores it', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`)
  })

  await openDemo(page)
  await page.getByRole('button', { name: 'Notes' }).click()
  await page.getByRole('button', { name: 'Add item' }).click()
  const editor = page.getByRole('dialog', { name: 'Note editor' })

  const moreActions = editor.getByRole('button', { name: 'More actions', exact: true })
  await moreActions.click()
  await page.getByRole('menuitem', { name: 'Reminder', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Reminder settings' })
  await expect(dialog).toBeVisible()

  // Time first, so Save is otherwise ready to go.
  await setTime(page, dialog, 9, 46, 'AM')

  // ── No date field until the mode is "Once" ──────────────────────────────────
  await expect(dialog.getByText('Date', { exact: true })).toHaveCount(0)

  await dialog.getByRole('button', { name: 'Daily', exact: true }).click()
  await dialog.getByRole('button', { name: 'Once', exact: true }).click()

  // ── Once reveals a pre-filled, valid, non-past date ──────────────────────────
  const dateTrigger = dialog.getByTestId('reminder-date-trigger')
  await expect(dateTrigger).toHaveCount(1)
  // Seeded with the reminder timezone's "today", spelled out in Vault typography.
  await expect(dateTrigger).toHaveAttribute('aria-label', /^Reminder date: /)
  await expect(dateTrigger).toHaveAttribute('aria-expanded', 'false')
  const todayStr = await page.evaluate(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  })
  const [ty, tm, td] = todayStr.split('-').map(Number)
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const monthNamesLong = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  await expect(dateTrigger).toHaveAttribute('aria-label', `Reminder date: ${td} ${monthNames[tm - 1]} ${ty}`)

  // ── Opening the custom calendar ─────────────────────────────────────────────
  await dateTrigger.click()
  const calendar = page.getByRole('dialog', { name: 'Choose date' })
  await expect(calendar).toBeVisible()
  await expect(dateTrigger).toHaveAttribute('aria-expanded', 'true')

  // The month header shows the current month, with custom (not native) nav.
  await expect(calendar.getByText(`${monthNames[tm - 1]}`, { exact: false })).toBeVisible()
  await expect(calendar.getByRole('button', { name: 'Previous month' })).toBeVisible()
  await expect(calendar.getByRole('button', { name: 'Next month' })).toBeVisible()

  // There must be no native date input anywhere — the whole point of the custom UI.
  await expect(dialog.locator('input[type="date"]')).toHaveCount(0)

  // Today is selectable and marked; earlier days in the same month are disabled.
  await expect(calendar.getByRole('button', { name: `${td} ${monthNamesLong[tm - 1]} ${ty}`, exact: true })).toBeEnabled()
  if (td > 1) {
    await expect(calendar.getByRole('button', { name: `1 ${monthNamesLong[tm - 1]} ${ty}`, exact: true })).toBeDisabled()
  }

  // ── Month navigation reaches the target month and back ──────────────────────
  // Click count is derived from the runtime month so this does not silently rot.
  const monthsToTarget = (2027 - ty) * 12 + (3 - tm)
  for (let i = 0; i < monthsToTarget; i++) await calendar.getByRole('button', { name: 'Next month' }).click()
  await expect(calendar.getByText('2027', { exact: true })).toBeVisible()
  await expect(calendar.getByRole('button', { name: '24 March 2027', exact: true })).toBeVisible()
  // Going back must not lose the selected date's month semantics; navigating is
  // display-only, so the field still reads today.
  for (let i = 0; i < monthsToTarget; i++) await calendar.getByRole('button', { name: 'Previous month' }).click()
  await expect(calendar.getByText(`${ty}`, { exact: true })).toBeVisible()
  await expect(calendar.getByRole('button', { name: `${td} ${monthNamesLong[tm - 1]} ${ty}`, exact: true })).toBeVisible()

  // ── Pick 24 March 2027 and save ─────────────────────────────────────────────
  for (let i = 0; i < monthsToTarget; i++) await calendar.getByRole('button', { name: 'Next month' }).click()
  await calendar.getByRole('button', { name: '24 March 2027', exact: true }).click()
  // Selecting closes the calendar and commits the exact date.
  await expect(calendar).toBeHidden()
  await expect(dateTrigger).toHaveAttribute('aria-label', 'Reminder date: 24 Mar 2027')
  await expect(dateTrigger).toHaveAttribute('aria-expanded', 'false')

  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).toBeHidden()

  // ── The saved date is spelled out on the chip and in the menu ────────────────
  await expect(editor.getByRole('button', { name: 'Once on 24 Mar 2027 at 09:46 AM' })).toBeVisible({ timeout: 5000 })
  await moreActions.click()
  await expect(page.getByRole('menuitem', { name: /Once\b.*24 Mar 2027.*09:46 AM/i })).toBeVisible({ timeout: 5000 })
  await page.keyboard.press('Escape')

  // ── Reopening restores the exact date ───────────────────────────────────────
  await moreActions.click()
  await page.getByRole('menuitem', { name: /Once\b.*24 Mar 2027/i }).click()
  const reopened = page.getByRole('dialog', { name: 'Reminder settings' })
  await expect(reopened).toBeVisible()
  await expect(reopened.getByTestId('reminder-date-trigger'))
    .toHaveAttribute('aria-label', 'Reminder date: 24 Mar 2027')
  // Reopening the calendar shows the SAVED date's month, not the current one.
  await reopened.getByTestId('reminder-date-trigger').click()
  const reopenedCalendar = page.getByRole('dialog', { name: 'Choose date' })
  await expect(reopenedCalendar.getByText('March')).toBeVisible()
  await expect(reopenedCalendar.getByText('2027')).toBeVisible()
  await expect(reopenedCalendar.getByRole('button', { name: '24 March 2027', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(reopenedCalendar).toBeHidden()

  // ── Once → Daily must clear the date: the field disappears entirely ─────────
  await reopened.getByRole('button', { name: 'Once', exact: true }).click()
  await reopened.getByRole('button', { name: 'Daily', exact: true }).click()
  await expect(reopened.getByTestId('reminder-date-trigger')).toHaveCount(0)
  await reopened.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(reopened).toBeHidden()

  // The reminder is now plain daily — no date can survive on a repeating row.
  await expect(editor.getByRole('button', { name: 'Daily reminder at 09:46 AM' })).toBeVisible({ timeout: 5000 })
  await moreActions.click()
  await expect(page.getByRole('menuitem', { name: /Daily\b.*09:46 AM/i })).toBeVisible({ timeout: 5000 })
  await page.keyboard.press('Escape')

  await moreActions.click()
  await page.getByRole('menuitem', { name: /Daily\b.*09:46 AM/i }).click()
  const backToDaily = page.getByRole('dialog', { name: 'Reminder settings' })
  await expect(backToDaily.getByTestId('reminder-date-trigger')).toHaveCount(0)

  // And switching back to Once re-arms a valid date rather than a stale one.
  await backToDaily.getByRole('button', { name: 'Daily', exact: true }).click()
  await backToDaily.getByRole('button', { name: 'Once', exact: true }).click()
  const rearmed = backToDaily.getByTestId('reminder-date-trigger')
  await expect(rearmed).toHaveAttribute('aria-label', `Reminder date: ${td} ${monthNames[tm - 1]} ${ty}`)
  await expectDialogContainedInViewport(page, backToDaily)
  await backToDaily.getByRole('button', { name: 'Close' }).click()

  expect(errors).toEqual([])
})

test('the custom calendar stays usable and overflow-free across narrow mobile widths', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))

  await openDemo(page)
  await page.getByRole('button', { name: 'Notes' }).click()
  await page.getByRole('button', { name: 'Add item' }).click()
  const editor = page.getByRole('dialog', { name: 'Note editor' })
  await editor.getByRole('button', { name: 'More actions', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Reminder', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Reminder settings' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Daily', exact: true }).click()
  await dialog.getByRole('button', { name: 'Once', exact: true }).click()
  await dialog.getByTestId('reminder-date-trigger').click()
  const calendar = page.getByRole('dialog', { name: 'Choose date' })
  await expect(calendar).toBeVisible()

  for (const viewport of CALENDAR_VIEWPORTS) {
    await page.setViewportSize(viewport)
    // The panel repositions itself on resize; wait for it to settle.
    await expect(calendar).toBeVisible()
    await expectDialogContainedInViewport(page, calendar)

    // The panel may not exceed the viewport, and the page must not pan sideways.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, `horizontal overflow at ${viewport.width}px`).toBeLessThanOrEqual(0)

    // Every day cell keeps a comfortable touch target.
    const dayBox = await calendar.getByRole('button', { name: /^\d+ [A-Z][a-z]+ \d{4}$/ }).first().boundingBox()
    if (!dayBox) throw new Error(`Day cell geometry missing at ${viewport.width}px`)
    expect(dayBox.height, `day cell height at ${viewport.width}px`).toBeGreaterThanOrEqual(39)
    expect(dayBox.width, `day cell width at ${viewport.width}px`).toBeGreaterThanOrEqual(39)
  }

  // Still a live calendar after all that resizing: pick an enabled day and commit
  // it. Day cells render just the day number, so this cannot match the month
  // navigation or the "Today" shortcut.
  const selectableDay = calendar.locator('button[aria-label]:not([disabled])').filter({ hasText: /^\d{1,2}$/ }).first()
  await selectableDay.click()
  await expect(calendar).toBeHidden()
  await expect(dialog.getByTestId('reminder-date-trigger')).toHaveAttribute('aria-expanded', 'false')

  expect(errors).toEqual([])
})

test('standalone reminders create, group, complete, and delete in primary Reminders view', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`)
  })

  await openDemo(page)

  // Navigate to Reminders in primary floating nav
  await page.getByRole('button', { name: 'Reminders' }).click()
  await expect(page.getByRole('heading', { name: 'Reminders' })).toBeVisible()

  // Create a new standalone reminder via global + (FAB)
  await page.getByRole('button', { name: 'Add item' }).click()
  const dialog = page.getByRole('dialog', { name: 'New Reminder' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Create Reminder' })).toBeVisible()

  await dialog.getByPlaceholder(/Renew car insurance/i).fill('Call dentist')
  await dialog.getByRole('button', { name: 'Daily', exact: true }).click()
  await dialog.getByRole('button', { name: 'Create Reminder' }).click()

  // Verify it appears in Today group
  await expect(page.getByText('Call dentist')).toBeVisible()
  await expect(page.getByText('Today')).toBeVisible()

  // Toggle completion
  const completeBtn = page.getByRole('button', { name: 'Mark reminder complete' })
  await completeBtn.click()
  await expect(page.getByRole('button', { name: 'Mark reminder incomplete' })).toBeVisible()

  // Edit reminder by clicking card
  await page.getByRole('button', { name: /Edit reminder Call dentist/i }).click()
  const editDialog = page.getByRole('dialog', { name: 'Edit Reminder' })
  await expect(editDialog).toBeVisible()
  await editDialog.getByPlaceholder(/Renew car insurance/i).fill('Call dentist office')
  await editDialog.getByRole('button', { name: 'Save Changes' }).click()
  await expect(page.getByText('Call dentist office')).toBeVisible()

  // Delete reminder
  await page.getByRole('button', { name: 'Delete reminder' }).click()
  await expect(page.getByText('Call dentist office')).toBeHidden()

  expect(errors).toEqual([])
})

test('All Items global + menu contains Reminder and triggers New Reminder dialog', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))

  await openDemo(page)
  await expect(page.getByRole('heading', { name: 'All items' })).toBeVisible()

  // Tap global + to open menu
  await page.getByRole('button', { name: 'Add item' }).click()

  // Menu items: Item, Note, Document, Reminder
  await expect(page.getByRole('menuitem', { name: /Item/i })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: /Note/i })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: /Document/i })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: /Reminder/i })).toBeVisible()

  // Click Reminder
  await page.getByRole('menuitem', { name: /Reminder/i }).click()

  // Should navigate to Reminders view and open New Reminder dialog
  const dialog = page.getByRole('dialog', { name: 'New Reminder' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Create Reminder' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible()

  // Cancel closes dialog cleanly
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()

  expect(errors).toEqual([])
})

test('reminders participate in the unified Favorites system with top-right heart and bottom-right done', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`)
  })

  await openDemo(page)

  // 1. Navigate to Reminders
  await page.getByRole('button', { name: 'Reminders' }).click()
  await expect(page.getByRole('heading', { name: 'Reminders' })).toBeVisible()

  // 2. Create a reminder
  await page.getByRole('button', { name: 'Add item' }).click()
  const dialog = page.getByRole('dialog', { name: 'New Reminder' })
  await expect(dialog).toBeVisible()
  await dialog.getByPlaceholder(/Renew car insurance/i).fill('Tax payment')
  await dialog.getByRole('button', { name: 'Daily', exact: true }).click()
  await dialog.getByRole('button', { name: 'Create Reminder' }).click()

  await expect(page.getByText('Tax payment')).toBeVisible()

  // 3. Top-right favorite button adds reminder to Favorites
  const favBtn = page.getByRole('button', { name: 'Add Tax payment to favorites' })
  await expect(favBtn).toBeVisible()
  await favBtn.click()
  await expect(page.getByRole('button', { name: 'Remove Tax payment from favorites' })).toBeVisible()

  // 4. Navigate to Favorites view
  await page.getByRole('button', { name: 'Favorites', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Favorites', exact: true })).toBeVisible()

  // Verify Reminders section in Favorites view
  await expect(page.getByRole('heading', { name: 'Reminders' })).toBeVisible()
  await expect(page.getByText('Tax payment')).toBeVisible()

  // 5. Mark as done in Favorites view
  const doneBtn = page.getByRole('button', { name: 'Mark reminder complete' }).first()
  await doneBtn.click()
  await expect(page.getByRole('button', { name: 'Mark reminder incomplete' }).first()).toBeVisible()
  // Still in Favorites
  await expect(page.getByText('Tax payment')).toBeVisible()

  // 6. Unfavorite removes it from Favorites view
  const unfavBtn = page.getByRole('button', { name: 'Remove Tax payment from favorites' })
  await unfavBtn.click()
  await expect(page.getByText('No favorite reminders.')).toBeVisible()

  expect(errors).toEqual([])
})

/**
 * Mobile footer containment — regression guard for the "Save Changes clips off
 * the right edge" bug (fixed: deliberate two-row mobile layout).
 *
 * Opens the standalone New Reminder editor at four mobile widths (320, 360, 390, 414)
 * and asserts:
 * 1. No horizontal overflow on the document
 * 2. Dialog panel is fully inside viewport
 * 3. Save / Create and Cancel buttons are visible and fully inside dialog bounds
 * 4. Buttons do not overlap
 * 5. Cancel button cleanly dismisses dialog
 */
const MOBILE_FOOTER_VIEWPORTS = [
  { label: '320 px', width: 320, height: 780 },
  { label: '360 px', width: 360, height: 780 },
  { label: '390 px', width: 390, height: 780 },
  { label: '414 px', width: 414, height: 780 },
]

for (const vp of MOBILE_FOOTER_VIEWPORTS) {
  test(`reminder editor footer fully contained at ${vp.label} viewport`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await openDemo(page)

    // Open standalone New Reminder dialog via global + -> Reminder menu item
    await page.getByRole('button', { name: 'Add item' }).click()
    await page.getByRole('menuitem', { name: /Reminder/i }).click()

    const dialog = page.getByRole('dialog', { name: 'New Reminder' })
    await expect(dialog).toBeVisible({ timeout: 10_000 })

    // 1. No horizontal document overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(scrollWidth).toBeLessThanOrEqual(vp.width)

    // 2. Dialog panel bounding box is inside the viewport
    const dialogBox = await dialog.boundingBox()
    expect(dialogBox).not.toBeNull()
    expect(dialogBox!.x).toBeGreaterThanOrEqual(-1)
    expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(vp.width + 1)

    // 3. Both visible buttons on mobile are rendered
    const saveBtn = dialog.getByRole('button', { name: /Create Reminder/i })
    const cancelBtn = dialog.getByRole('button', { name: 'Cancel' })
    await expect(saveBtn).toBeVisible()
    await expect(cancelBtn).toBeVisible()

    // 4. Each button's bounding box is fully inside the dialog panel (2 px tolerance)
    const tolerance = 2
    for (const btn of [saveBtn, cancelBtn]) {
      const btnBox = await btn.boundingBox()
      expect(btnBox).not.toBeNull()
      expect(btnBox!.x).toBeGreaterThanOrEqual(dialogBox!.x - tolerance)
      expect(btnBox!.x + btnBox!.width).toBeLessThanOrEqual(
        dialogBox!.x + dialogBox!.width + tolerance,
      )
    }

    // 5. Buttons do not overlap vertically (two-row deliberate layout on mobile)
    const saveBox = await saveBtn.boundingBox()
    const cancelBox = await cancelBtn.boundingBox()
    if (saveBox && cancelBox) {
      expect(saveBox.y).toBeGreaterThanOrEqual(cancelBox.y + cancelBox.height - 2)
    }

    // 6. Cancel closes dialog cleanly
    await cancelBtn.click()
    await expect(dialog).toBeHidden()
  })
}


/**
 * Recurrence switching — regression guard for the single-scroll-region layout.
 *
 * Opens the standalone New Reminder editor at a mobile viewport and cycles
 * Once -> Weekly -> Daily, asserting after each switch:
 * 1. The mode-specific field appears/disappears correctly
 * 2. The dialog panel stays fully inside the viewport
 * 3. Footer actions remain visible and inside the dialog
 */
test('reminder editor recurrence switching stays contained at mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 })
  await openDemo(page)

  await page.getByRole('button', { name: 'Add item' }).click()
  await page.getByRole('menuitem', { name: /Reminder/i }).click()

  const dialog = page.getByRole('dialog', { name: 'New Reminder' })
  await expect(dialog).toBeVisible({ timeout: 10_000 })

  const saveBtn = dialog.getByRole('button', { name: /Create Reminder/i })
  const cancelBtn = dialog.getByRole('button', { name: 'Cancel' })

  const expectContained = async () => {
    const dialogBox = await dialog.boundingBox()
    const viewport = page.viewportSize()
    expect(dialogBox).not.toBeNull()
    expect(viewport).not.toBeNull()
    expect(dialogBox!.x).toBeGreaterThanOrEqual(-1)
    expect(dialogBox!.y).toBeGreaterThanOrEqual(-1)
    expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(viewport!.width + 1)
    expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(viewport!.height + 1)
    await expect(saveBtn).toBeVisible()
    await expect(cancelBtn).toBeVisible()
  }

  // Default is Daily — no date field, no weekday row
  await expect(dialog.getByText('Day of the Week')).toHaveCount(0)
  await expectContained()

  // Once — date field appears, dialog stays contained on the short 640 px viewport
  await dialog.getByRole('button', { name: 'Once', exact: true }).click()
  await expect(dialog.getByText('Date *')).toBeVisible()
  await expect(dialog.getByText('Day of the Week')).toHaveCount(0)
  await expectContained()

  // Weekly — weekday row appears, date field disappears
  await dialog.getByRole('button', { name: 'Weekly', exact: true }).click()
  await expect(dialog.getByText('Day of the Week')).toBeVisible()
  await expect(dialog.getByText('Date *')).toHaveCount(0)
  await expectContained()

  // Back to Daily — both mode-specific fields gone, no leftover scroll residue
  await dialog.getByRole('button', { name: 'Daily', exact: true }).click()
  await expect(dialog.getByText('Day of the Week')).toHaveCount(0)
  await expect(dialog.getByText('Date *')).toHaveCount(0)
  await expectContained()

  // Escape closes the dialog and focus returns cleanly
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})
