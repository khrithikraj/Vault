import { expect, test, type Locator, type Page } from '@playwright/test'

async function expectDialogContainedInViewport(page: Page, dialog: Locator) {
  const box = await dialog.boundingBox()
  const viewport = page.viewportSize()
  if (!box || !viewport) throw new Error('Missing dialog box or viewport size')
  expect(box.x).toBeGreaterThanOrEqual(-1)
  expect(box.y).toBeGreaterThanOrEqual(-1)
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1)
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1)
}

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
  const moreActions = editor.getByRole('button', { name: 'More actions' })
  await moreActions.click()
  await page.getByRole('menuitem', { name: 'Reminder', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Reminder settings' })
  await expect(dialog).toBeVisible()
  await expectDialogContainedInViewport(page, dialog)
  await expect(dialog.getByText('--:-- --')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()

  // Type 09:46 AM via real keystrokes (not .fill)
  await dialog.getByRole('textbox', { name: 'Hour' }).click()
  await page.keyboard.type('09')
  await dialog.getByRole('textbox', { name: 'Minute' }).click()
  await page.keyboard.type('46')
  await expect(dialog.getByText('09:46 AM')).toBeVisible({ timeout: 5000 })
  await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeEnabled()

  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).toBeHidden()
  await moreActions.click()
  await expect(page.getByRole('menuitem', { name: /Daily · 09:46 AM/i })).toBeVisible({ timeout: 5000 })
  await page.keyboard.press('Escape')

  // Reopen — saved time must be loaded back
  await moreActions.click()
  await page.getByRole('menuitem', { name: /Daily · 09:46 AM/i }).click()
  const dialog2 = page.getByRole('dialog', { name: 'Reminder settings' })
  await expect(dialog2).toBeVisible()
  await expect(dialog2.getByRole('textbox', { name: 'Hour' })).toHaveValue('09')
  await expect(dialog2.getByRole('textbox', { name: 'Minute' })).toHaveValue('46')
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
  const itemBtn = editor.getByRole('button', { name: 'Set item reminder' })
  await expect(itemBtn).toBeVisible()
  await itemBtn.click()

  const itemDialog = page.getByRole('dialog', { name: 'Reminder settings' })
  await expect(itemDialog).toBeVisible()
  await expectDialogContainedInViewport(page, itemDialog)

  // The item ReminderControl is the same component instance that held the note's
  // 09:46 AM, so the picker opens pre-filled. Note-level typing above already proves
  // the real-keystroke path; here fill() sets each field deterministically (the
  // picker's onChange eagerly commits full 2-digit values, avoiding the keystroke
  // race this machine hits under full parallel load).
  await itemDialog.getByRole('textbox', { name: 'Hour' }).fill('12')
  await expect(itemDialog.getByRole('textbox', { name: 'Hour' })).toHaveValue('12')
  await itemDialog.getByRole('button', { name: 'PM', exact: true }).click()
  await itemDialog.getByRole('textbox', { name: 'Minute' }).fill('32')
  await expect(itemDialog.getByText('12:32 PM')).toBeVisible({ timeout: 5000 })
  await itemDialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(editor.getByRole('button', { name: /reminder at 12:32 PM/i })).toBeVisible({ timeout: 5000 })

  // Edit to 12:46 PM
  await editor.getByRole('button', { name: /reminder at 12:32 PM/i }).click()
  const itemDialog2 = page.getByRole('dialog', { name: 'Reminder settings' })
  await expect(itemDialog2).toBeVisible()
  await expect(itemDialog2.getByRole('textbox', { name: 'Minute' })).toHaveValue('32')
  await itemDialog2.getByRole('textbox', { name: 'Minute' }).fill('46')
  await expect(itemDialog2.getByText('12:46 PM')).toBeVisible({ timeout: 5000 })
  await itemDialog2.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(editor.getByRole('button', { name: /reminder at 12:46 PM/i })).toBeVisible({ timeout: 5000 })

  // Remove
  await editor.getByRole('button', { name: /reminder at 12:46 PM/i }).click()
  const itemDialog3 = page.getByRole('dialog', { name: 'Reminder settings' })
  await expect(itemDialog3).toBeVisible()
  await itemDialog3.getByRole('button', { name: 'Remove' }).click()
  await expect(editor.getByRole('button', { name: 'Set item reminder' })).toBeVisible({ timeout: 5000 })

  expect(errors).toEqual([])
})
