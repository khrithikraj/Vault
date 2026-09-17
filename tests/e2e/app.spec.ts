import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'

/** The reminder popover must never overflow the viewport on any breakpoint. */
async function expectDialogContainedInViewport(page: Page, dialog: Locator) {
  const box = await dialog.boundingBox()
  const viewport = page.viewportSize()
  if (!box || !viewport) throw new Error('Missing dialog box or viewport size')
  const tolerance = 1
  expect(box.x).toBeGreaterThanOrEqual(-tolerance)
  expect(box.y).toBeGreaterThanOrEqual(-tolerance)
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + tolerance)
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + tolerance)
}

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

test('authenticated home exposes the canonical section structure', async ({ page }) => {
  await openDemo(page)

  await expect(page.getByRole('region', { name: 'All items' })).toContainText('0 items')
  await expect(page.getByRole('heading', { name: 'Categories' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Categories' })).toContainText('categories')

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)

  await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      try {
        animation.commitStyles?.()
        animation.cancel()
      } catch {
        /* already settled */
      }
    }
  })

  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
})

test('search exposes its scope and clears without losing focus', async ({ page }) => {
  await openDemo(page)

  const search = page.getByRole('searchbox', { name: 'Search' })
  await search.fill('no-such-record')
  await expect(page.getByText('No results in All items')).toBeVisible()
  await expect(page.getByText(/Nothing matches/)).toContainText('no-such-record')

  await page.getByLabel('Clear search').click()
  await expect(search).toHaveValue('')
  await expect(search).toBeFocused()

  await page.getByRole('button', { name: 'Notes' }).click()
  await search.fill('still-no-result')
  await expect(page.getByText('No results in Notes')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(search).toHaveValue('')
  await expect(search).toBeFocused()
})

test('account dialog traps and restores focus while isolating the page', async ({ page }) => {
  await openDemo(page)

  const accountTrigger = page.getByRole('button', { name: 'Preview mode account panel' })
  await accountTrigger.click()

  const dialog = page.getByRole('dialog', { name: 'Account' })
  await expect(dialog).toBeVisible()
  await expect(page).toHaveTitle("Account · Raj's Vault")
  await expect(page.getByRole('button', { name: 'Close' })).toBeFocused()
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden')
  await expect(page.locator('main > [inert]').first()).toBeAttached()

  await page.keyboard.press('Shift+Tab')
  await expect(dialog.locator(':focus')).toHaveCount(1)

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(page).toHaveTitle("All items · Raj's Vault")
  await expect(accountTrigger).toBeFocused()
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
})

test('nested confirmation closes one dialog at a time', async ({ page }) => {
  await openDemo(page)

  const accountTrigger = page.getByRole('button', { name: 'Preview mode account panel' })
  await accountTrigger.click()
  await page.getByRole('button', { name: 'Exit preview' }).click()

  const confirmation = page.getByRole('dialog', { name: 'Exit preview?' })
  await expect(confirmation).toBeVisible()
  await page.keyboard.press('Escape')

  await expect(confirmation).toBeHidden()
  await expect(page.getByRole('dialog', { name: 'Account' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Exit preview' })).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Account' })).toBeHidden()
  await expect(accountTrigger).toBeFocused()
})

test('global surfaces follow the canonical layer order', async ({ page }) => {
  await openDemo(page)

  const navigation = page.getByRole('navigation', { name: 'Primary navigation' })
  await expect(navigation).toHaveCSS('z-index', '30')

  await page.getByRole('button', { name: 'Add item' }).click()
  const quickAdd = page.getByRole('menu', { name: 'Quick add actions' })
  await expect(quickAdd).toBeVisible()
  await expect(quickAdd).toHaveCSS('z-index', '60')
  await expect(page.getByRole('menuitem', { name: /Item/ })).toBeFocused()
  await page.keyboard.press('End')
  await expect(page.getByRole('menuitem', { name: /Document/ })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Add item' })).toBeFocused()

  await page.getByRole('button', { name: 'Preview mode account panel' }).click()
  await expect(page.getByRole('dialog', { name: 'Account' })).toHaveCSS('z-index', 'auto')
  await expect(page.getByRole('dialog', { name: 'Account' }).locator('..')).toHaveCSS('z-index', '60')
})

test('primary content views share section and empty-state patterns', async ({ page }) => {
  await openDemo(page)

  await expect(page).toHaveTitle("All items · Raj's Vault")
  await expect(page.getByRole('button', { name: 'All items' })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toContainText('All items')
  await page.getByRole('button', { name: 'Notes' }).click()
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible()
  await expect(page).toHaveTitle("Notes · Raj's Vault")
  await expect(page.getByText('No notes yet')).toBeVisible()

  await page.getByRole('button', { name: 'Documents' }).click()
  await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible()
  await expect(page).toHaveTitle("Documents · Raj's Vault")
  await expect(page.getByText('No documents yet')).toBeVisible()

  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible()
  await expect(page).toHaveTitle("Notes · Raj's Vault")

  await page.getByRole('button', { name: 'Trash' }).click()
  await expect(page.getByRole('heading', { name: 'Recently Deleted' })).toBeVisible()
  await expect(page.getByText('Recently Deleted is empty')).toBeVisible()
  await expect(page).toHaveTitle("Recently Deleted · Raj's Vault")

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
})

test('note editor uses the shared dialog contract', async ({ page }) => {
  await openDemo(page)
  await page.getByRole('button', { name: 'Notes' }).click()
  expect(await page.evaluate(() => window.history.state)).toEqual({ vaultSection: true })

  const newNote = page.getByRole('button', { name: 'New note' })
  await newNote.click()

  const editor = page.getByRole('dialog', { name: 'Note editor' })
  await expect(editor).toBeVisible()
  expect(await page.evaluate(() => window.history.state)).toEqual({ vaultOverlay: true })
  await expect(page.getByRole('button', { name: 'Close' })).toBeFocused()
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden')

  await page.keyboard.press('Escape')
  await expect(editor).toBeHidden()
  expect(await page.evaluate(() => window.history.state)).toEqual({ vaultSection: true })
  await expect(page.locator('button', { hasText: 'New note' })).toBeAttached()
  await expect(page.locator('[inert]')).toHaveCount(0)
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible()
  await expect(newNote).toBeFocused()
})

test('document uploader uses the shared dialog contract', async ({ page }) => {
  await openDemo(page)
  await page.getByRole('button', { name: 'Documents' }).click()

  const addDocument = page.getByRole('button', { name: 'Add Document' })
  await addDocument.click()

  const uploader = page.getByRole('dialog', { name: 'Add document' })
  const nameInput = page.getByLabel('Document name *')
  await expect(uploader).toBeVisible()
  await expect(nameInput).toBeFocused()
  await expect(nameInput).toHaveAttribute('required', '')
  await expect(page.getByRole('button', { name: 'Upload', exact: true })).toBeDisabled()
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden')

  await page.keyboard.press('Escape')
  await expect(uploader).toBeHidden()
  await expect(addDocument).toBeFocused()
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
})

test('vault select supports keyboard navigation without closing its dialog', async ({ page }) => {
  await openDemo(page)
  await page.getByRole('button', { name: 'Documents' }).click()
  await page.getByRole('button', { name: 'Add Document' }).click()

  const uploader = page.getByRole('dialog', { name: 'Add document' })
  const category = uploader.getByRole('button', { name: 'Category' })
  await category.focus()
  await page.keyboard.press('ArrowDown')

  const listbox = page.getByRole('listbox')
  const lastOption = listbox.getByRole('option').last()
  await expect(listbox).toBeVisible()
  await page.keyboard.press('End')
  await expect(lastOption).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(listbox).toBeHidden()
  await expect(category).toBeFocused()
  await expect(uploader).toBeVisible()

  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('End')
  const lastLabel = (await lastOption.textContent())?.trim() ?? ''
  await page.keyboard.press('Enter')
  await expect(listbox).toBeHidden()
  await expect(category).toContainText(lastLabel)
})

test('sort menu supports roving keyboard selection', async ({ page }) => {
  await openDemo(page)

  const sort = page.getByRole('region', { name: 'All items' }).locator('button[aria-haspopup="listbox"]')
  await expect(sort).toHaveAttribute('aria-label', 'Sort by Newest added')
  await sort.focus()
  await page.keyboard.press('ArrowDown')

  const listbox = page.getByRole('listbox')
  const lastOption = listbox.getByRole('option').last()
  await expect(listbox).toBeVisible()
  await page.keyboard.press('End')
  await expect(lastOption).toBeFocused()
  const lastLabel = (await lastOption.textContent())?.trim() ?? ''
  await page.keyboard.press('Enter')

  await expect(listbox).toBeHidden()
  await expect(sort).toBeFocused()
  await expect(sort).toHaveAttribute('aria-label', `Sort by ${lastLabel}`)
})

test('category editor uses the shared dialog contract', async ({ page }) => {
  await openDemo(page)

  const editCategory = page.getByRole('button', { name: 'Edit Food Spots' })
  await editCategory.click()

  const editor = page.getByRole('dialog', { name: 'Edit category' })
  const nameInput = page.getByLabel('Category name')
  await expect(editor).toBeVisible()
  await expect(nameInput).toBeFocused()
  await expect(nameInput).toHaveValue('Food Spots')
  await page.getByRole('button', { name: /Fields/ }).click()
  await expect(page.getByText('Define the custom fields captured')).toBeVisible()
  await expect(page.getByText('Capture preview')).toBeVisible()
  await page.getByRole('button', { name: 'Add new field' }).click()
  const newField = page.getByPlaceholder('Field label (e.g. Website, Price, Username)').last()
  await newField.fill('Booking code')
  await expect(page.getByText('Booking code', { exact: true })).toBeVisible()
  await newField.press('Alt+ArrowUp')
  await page.getByRole('button', { name: 'Remove field' }).last().click()
  const removeConfirmation = page.getByRole('dialog', { name: 'Remove this field?' })
  await expect(removeConfirmation).toBeVisible()
  await removeConfirmation.getByRole('button', { name: 'Cancel', exact: true }).last().click()
  await expect(editor).toBeVisible()
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden')

  await page.keyboard.press('Escape')
  const discardConfirmation = page.getByRole('dialog', { name: 'Discard category changes?' })
  await expect(discardConfirmation).toBeVisible()
  await discardConfirmation.getByRole('button', { name: 'Discard changes' }).click()
  await expect(editor).toBeHidden()
  await expect(editCategory).toBeFocused()
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
})

test('capture wizard uses the shared dialog contract', async ({ page }) => {
  await openDemo(page)

  const addItem = page.getByRole('button', { name: 'Add item' })
  await addItem.click()
  await page.getByRole('menuitem', { name: /Item/ }).click()

  const capture = page.getByRole('dialog', { name: 'Add item' })
  await expect(capture).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cancel item' })).toBeFocused()
  await expect(page.getByRole('heading', { name: 'Where does this belong?' })).toBeVisible()
  await expect(page.getByRole('progressbar', { name: 'Add item progress' })).toHaveAttribute('aria-valuenow', '1')
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden')
  await expect(page.locator('main > [inert]').first()).toBeAttached()

  await capture.getByRole('button', { name: 'Food Spots' }).click()
  await expect(page.getByRole('progressbar', { name: 'Add item progress' })).toHaveAttribute('aria-valuenow', '2')
  await capture.getByRole('button', { name: 'Skip →' }).click()
  const titleInput = capture.getByRole('textbox')
  await capture.getByRole('button', { name: 'Continue →' }).click()
  await expect(capture.getByRole('alert')).toHaveText('Place name is required.')
  await titleInput.fill('Draft cafe')

  await page.keyboard.press('Escape')
  await expect(capture).toBeHidden()
  await expect(addItem).toBeFocused()
  await expect(page.locator('[inert]')).toHaveCount(0)
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')

  await addItem.click()
  await page.getByRole('menuitem', { name: /Item/ }).click()
  await expect(page.getByRole('dialog', { name: 'Add item' }).getByRole('textbox')).toHaveValue('Draft cafe')
  await expect(page.getByText('Draft kept in this tab')).toBeVisible()
  await page.keyboard.press('Escape')
})

test('item detail uses the shared dialog and history contract', async ({ page }) => {
  await openDemo(page)

  await page.getByRole('button', { name: 'Add item' }).click()
  await page.getByRole('menuitem', { name: /Item/ }).click()
  const capture = page.getByRole('dialog', { name: 'Add item' })
  await capture.getByRole('button', { name: 'Food Spots' }).click()
  await capture.getByRole('button', { name: 'Skip →' }).click()
  await expect(capture.getByRole('heading', { name: /> Place name/ })).toBeVisible()
  await capture.getByRole('textbox').fill('Phase Two Cafe')
  await capture.getByRole('button', { name: 'Continue →' }).click()
  await expect(capture.getByRole('heading', { name: /> Dish to try/ })).toBeVisible()
  await capture.getByRole('textbox').fill('Dosa')
  await capture.getByRole('button', { name: 'Continue →' }).click()
  await expect(capture.getByRole('heading', { name: /> Address/ })).toBeVisible()
  await capture.getByRole('button', { name: 'Continue →' }).click()
  await expect(capture.getByRole('heading', { name: /> Price/ })).toBeVisible()
  await capture.getByRole('button', { name: 'Continue →' }).click()
  await expect(capture.getByRole('heading', { name: /> Notes/ })).toBeVisible()
  await capture.getByRole('button', { name: 'Review →' }).click()
  await capture.getByRole('button', { name: 'Save to vault' }).click()
  await expect(capture).toBeHidden()

  const itemCard = page.getByRole('button', { name: 'Phase Two Cafe, archived item' })
  await page.getByRole('button', { name: 'Add Phase Two Cafe to favorites' }).click()
  await page.getByRole('button', { name: 'Favorites', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Favorites' })).toBeVisible()
  await expect(page).toHaveTitle("Favorites · Raj's Vault")
  await expect(itemCard).toBeVisible()
  await page.getByRole('button', { name: 'Remove Phase Two Cafe from favorites' }).click()
  await expect(page.getByText('No favorites yet')).toBeVisible()
  await page.getByRole('button', { name: 'All items', exact: true }).click()
  await expect(itemCard).toBeVisible()
  const search = page.getByRole('searchbox', { name: 'Search' })
  await search.fill('Dosa')
  await expect(page.getByRole('heading', { name: /Search results · 1 result · All items/ })).toBeVisible()
  await expect(itemCard).toContainText('Dish to try')
  await itemCard.focus()
  await page.keyboard.press('Enter')

  const detail = page.getByRole('dialog', { name: 'Item details' })
  await expect(detail).toBeVisible()
  await expect(page.getByRole('button', { name: 'Close item details' })).toBeFocused()
  expect(await page.evaluate(() => window.history.state)).toEqual({ vaultOverlay: true })

  const deleteItem = detail.getByRole('button', { name: 'Delete' })
  await deleteItem.click()
  const confirmation = page.getByRole('dialog', { name: 'Move to trash?' })
  await expect(confirmation).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(confirmation).toBeHidden()
  await expect(detail).toBeVisible()
  await expect(deleteItem).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(detail).toBeHidden()
  await expect(itemCard).toBeFocused()
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')

  await page.getByRole('button', { name: 'Delete Phase Two Cafe' }).click()
  await expect(itemCard).toBeHidden()
  const undo = page.getByRole('button', { name: 'Undo' })
  await expect(undo).toBeVisible()
  await undo.click()
  await expect(itemCard).toBeVisible()
  await itemCard.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'Item details' })).toBeVisible()
})

test('note-level reminders and checklist completion controls', async ({ page }) => {
  await openDemo(page)
  await page.getByRole('button', { name: 'Notes' }).click()
  await page.getByRole('button', { name: 'New note' }).click()

  const editor = page.getByRole('dialog', { name: 'Note editor' })

  // Note-level reminder
  const reminderTrigger = editor.getByRole('button', { name: /Set reminder/i })
  await expect(reminderTrigger).toBeVisible()
  await reminderTrigger.click()
  const reminderDialog = page.getByRole('dialog', { name: 'Reminder settings' })
  await expect(reminderDialog).toBeVisible()
  await expectDialogContainedInViewport(page, reminderDialog)

  // Save is disabled until a time is selected
  const saveButton = reminderDialog.getByRole('button', { name: 'Save', exact: true })
  await expect(saveButton).toBeDisabled()

  // Type custom minute directly (09:46 AM)
  const hourInput = reminderDialog.getByRole('textbox', { name: 'Hour' })
  const minuteInput = reminderDialog.getByRole('textbox', { name: 'Minute' })
  await hourInput.fill('09')
  await minuteInput.fill('46')
  await expect(reminderDialog.getByText('09:46 AM')).toBeVisible()
  await expect(saveButton).toBeEnabled()

  // Change repeat to Weekdays
  await reminderDialog.getByRole('button', { name: /Daily/ }).click()
  await reminderDialog.getByRole('button', { name: 'Weekdays' }).click()

  await saveButton.click()
  await expect(editor.getByRole('button', { name: /Weekdays · 09:46 AM/i })).toBeVisible()

  // Clean checklist row and strikethrough
  await editor.getByPlaceholder('Add new task or list item...').fill('DSA practice')
  await editor.getByRole('button', { name: 'Add', exact: true }).click()
  const itemInput = editor.locator('input[value="DSA practice"]')
  await expect(itemInput).toBeVisible()

  // Unified item-level reminder button opens the same custom time picker dialog
  const itemReminderBtn = editor.getByRole('button', { name: 'Set item reminder' })
  await expect(itemReminderBtn).toBeVisible()
  await itemReminderBtn.click()

  const itemReminderDialog = page.getByRole('dialog', { name: 'Reminder settings' })
  await expect(itemReminderDialog).toBeVisible()
  await expectDialogContainedInViewport(page, itemReminderDialog)
  await expect(itemReminderDialog.getByText('DSA practice')).toBeVisible()

  // Select 01:00 PM preset and save
  await itemReminderDialog.getByRole('button', { name: '01:00PM', exact: true }).click()
  await itemReminderDialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(editor.getByRole('button', { name: /Daily reminder at 01:00 PM/i })).toBeVisible()

  // Checking item applies strikethrough
  await editor.getByRole('checkbox').last().check()
  await expect(editor.getByRole('checkbox').last()).toBeChecked()
  await expect(itemInput).toHaveClass(/line-through/)
})

test('food spot branch management preserves the parent item and branch search text', async ({ page }) => {
  await openDemo(page)
  await page.getByRole('button', { name: 'Add item' }).click()
  await page.getByRole('menuitem', { name: /Item/ }).click()
  const capture = page.getByRole('dialog', { name: 'Add item' })
  await capture.getByRole('button', { name: 'Food Spots' }).click()
  await capture.getByRole('button', { name: 'Skip →' }).click()
  await expect(capture.getByRole('heading', { name: /> Place name/ })).toBeVisible()
  await capture.getByRole('textbox').fill('Branch Cafe')
  await capture.getByRole('button', { name: 'Continue →' }).click()
  await expect(capture.getByRole('heading', { name: /> Dish to try/ })).toBeVisible()
  await capture.getByRole('textbox').fill('Dosa')
  await capture.getByRole('button', { name: 'Continue →' }).click()
  await expect(capture.getByRole('heading', { name: /> Address/ })).toBeVisible()
  await capture.getByRole('button', { name: 'Continue →' }).click()
  await expect(capture.getByRole('heading', { name: /> Price/ })).toBeVisible()
  await capture.getByRole('button', { name: 'Continue →' }).click()
  await expect(capture.getByRole('heading', { name: /> Notes/ })).toBeVisible()
  await capture.getByRole('button', { name: 'Review →' }).click()
  await capture.getByRole('button', { name: 'Save to vault' }).click()

  await page.getByRole('button', { name: 'Branch Cafe, archived item' }).click()
  const detail = page.getByRole('dialog', { name: 'Item details' })
  await detail.getByRole('button', { name: 'Add branch' }).click()
  await detail.getByLabel('Branch name').fill('Gachibowli')
  await detail.getByLabel('Branch address').fill('Gachibowli Main Road')
  await detail.getByRole('button', { name: 'Save branch' }).click()
  await expect(detail.getByText('Gachibowli', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Close item details' }).click()
  await page.getByRole('searchbox', { name: 'Search' }).fill('Gachibowli')
  await expect(page.getByRole('button', { name: 'Branch Cafe, archived item' })).toBeVisible()
})

test('favorites page groups items and notes and searches across both', async ({ page }) => {
  await openDemo(page)

  await page.getByRole('button', { name: 'Add item' }).click()
  await page.getByRole('menuitem', { name: /Item/ }).click()
  const capture = page.getByRole('dialog', { name: 'Add item' })
  await capture.getByRole('button', { name: 'Food Spots' }).click()
  await capture.getByRole('button', { name: 'Skip →' }).click()
  await expect(capture.getByRole('heading', { name: /> Place name/ })).toBeVisible()
  await capture.getByRole('textbox').fill('Noodle Bar')
  await capture.getByRole('button', { name: 'Continue →' }).click()
  await expect(capture.getByRole('heading', { name: /> Dish to try/ })).toBeVisible()
  await capture.getByRole('textbox').fill('Khao suey')
  await capture.getByRole('button', { name: 'Continue →' }).click()
  await expect(capture.getByRole('heading', { name: /> Address/ })).toBeVisible()
  await capture.getByRole('button', { name: 'Continue →' }).click()
  await expect(capture.getByRole('heading', { name: /> Price/ })).toBeVisible()
  await capture.getByRole('button', { name: 'Continue →' }).click()
  await expect(capture.getByRole('heading', { name: /> Notes/ })).toBeVisible()
  await capture.getByRole('button', { name: 'Review →' }).click()
  await capture.getByRole('button', { name: 'Save to vault' }).click()

  const itemCard = page.getByRole('button', { name: 'Noodle Bar, archived item' })
  await page.getByRole('button', { name: 'Add Noodle Bar to favorites' }).click()

  await page.getByRole('button', { name: 'Notes' }).click()
  await page.getByRole('button', { name: 'New note' }).click()
  const editor = page.getByRole('dialog', { name: 'Note editor' })
  await editor.getByPlaceholder('Note title...').fill('Stretching habit')
  await page.waitForTimeout(800)
  await editor.getByRole('button', { name: /Back to notes/ }).click()
  await page.getByRole('button', { name: 'Add Stretching habit to favorites' }).click()

  await page.getByRole('button', { name: 'Favorites', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Favorites' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Items' })).toBeVisible()
  await expect(itemCard).toBeVisible()
  await page.getByRole('button', { name: 'Remove Noodle Bar from favorites' }).click()
  await expect(page.getByText('No favorites yet')).toBeVisible()

  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Remove Stretching habit from favorites' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible()
  await expect(page.getByText('No favorite documents.')).toBeVisible()

  const search = page.getByRole('searchbox', { name: 'Search' })
  await search.fill('Stretching')
  await expect(page.getByRole('heading', { name: /Search results · 1 result · Favorites/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Remove Stretching habit from favorites' })).toBeVisible()
})

test('trash restore keeps an item favorited', async ({ page }) => {
  await openDemo(page)

  await page.getByRole('button', { name: 'Add item' }).click()
  await page.getByRole('menuitem', { name: /Item/ }).click()
  const capture = page.getByRole('dialog', { name: 'Add item' })
  await capture.getByRole('button', { name: 'Food Spots' }).click()
  await capture.getByRole('button', { name: 'Skip →' }).click()
  await expect(capture.getByRole('heading', { name: /> Place name/ })).toBeVisible()
  await capture.getByRole('textbox').fill('Favorite Keeper')
  await capture.getByRole('button', { name: 'Continue →' }).click()
  await expect(capture.getByRole('heading', { name: /> Dish to try/ })).toBeVisible()
  await capture.getByRole('textbox').fill('Chai')
  await capture.getByRole('button', { name: 'Continue →' }).click()
  await expect(capture.getByRole('heading', { name: /> Address/ })).toBeVisible()
  await capture.getByRole('button', { name: 'Continue →' }).click()
  await expect(capture.getByRole('heading', { name: /> Price/ })).toBeVisible()
  await capture.getByRole('button', { name: 'Continue →' }).click()
  await expect(capture.getByRole('heading', { name: /> Notes/ })).toBeVisible()
  await capture.getByRole('button', { name: 'Review →' }).click()
  await capture.getByRole('button', { name: 'Save to vault' }).click()

  const itemCard = page.getByRole('button', { name: 'Favorite Keeper, archived item' })
  await page.getByRole('button', { name: 'Add Favorite Keeper to favorites' }).click()

  await page.getByRole('button', { name: 'Delete Favorite Keeper' }).click()
  await expect(itemCard).toBeHidden()
  await page.getByRole('button', { name: 'Favorites', exact: true }).click()
  await expect(page.getByText('No favorites yet')).toBeVisible()

  await page.getByRole('button', { name: 'Trash' }).click()
  await page.getByRole('button', { name: 'Restore' }).click()
  await expect(page.getByText('Recently Deleted is empty')).toBeVisible()

  await page.getByRole('button', { name: 'Favorites', exact: true }).click()
  await expect(itemCard).toBeVisible()
  await expect(page.getByRole('button', { name: 'Remove Favorite Keeper from favorites' })).toBeVisible()
})

test('food spot legacy address becomes an editable branch and survives edit and remove', async ({ page }) => {
  await openDemo(page)
  await page.getByRole('button', { name: 'Add item' }).click()
  await page.getByRole('menuitem', { name: /Item/ }).click()
  const capture = page.getByRole('dialog', { name: 'Add item' })
  await capture.getByRole('button', { name: 'Food Spots' }).click()
  await capture.getByRole('button', { name: 'Skip →' }).click()
  await expect(capture.getByRole('heading', { name: /> Place name/ })).toBeVisible()
  await capture.getByRole('textbox').fill('Legacy Cafe')
  await capture.getByRole('button', { name: 'Continue →' }).click()
  await expect(capture.getByRole('heading', { name: /> Dish to try/ })).toBeVisible()
  await capture.getByRole('textbox').fill('Filter coffee')
  await capture.getByRole('button', { name: 'Continue →' }).click()
  await expect(capture.getByRole('heading', { name: /> Address/ })).toBeVisible()
  await capture.getByRole('textbox').fill('MG Road')
  await capture.getByRole('button', { name: 'Continue →' }).click()
  await expect(capture.getByRole('heading', { name: /> Price/ })).toBeVisible()
  await capture.getByRole('button', { name: 'Continue →' }).click()
  await expect(capture.getByRole('heading', { name: /> Notes/ })).toBeVisible()
  await capture.getByRole('button', { name: 'Review →' }).click()
  await capture.getByRole('button', { name: 'Save to vault' }).click()

  const itemCard = page.getByRole('button', { name: 'Legacy Cafe, archived item' })
  await itemCard.click()
  const detail = page.getByRole('dialog', { name: 'Item details' })
  await expect(detail.getByText('MG Road', { exact: true }).first()).toBeVisible()
  await expect(detail.getByText('Legacy Cafe', { exact: true }).first()).toBeVisible()

  await detail.getByRole('button', { name: 'Edit Legacy Cafe' }).click()
  await detail.getByLabel('Branch name').fill('HQ')
  await detail.getByRole('button', { name: 'Save branch' }).click()
  await expect(detail.getByText('HQ', { exact: true })).toBeVisible()
  await expect(detail.getByText('MG Road', { exact: true }).first()).toBeVisible()

  await detail.getByRole('button', { name: 'Add branch' }).click()
  await detail.getByLabel('Branch name').fill('Kukatpally')
  await detail.getByLabel('Branch address').fill('Highway Rd')
  await detail.getByRole('button', { name: 'Save branch' }).click()
  await expect(detail.getByText('Highway Rd', { exact: true })).toBeVisible()

  await detail.getByRole('button', { name: 'Remove Kukatpally' }).click()
  await expect(detail.getByText('Kukatpally', { exact: true })).toHaveCount(0)
  await expect(detail.getByText('Highway Rd', { exact: true })).toHaveCount(0)
  await expect(detail.getByText('HQ', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Close item details' }).click()
  await page.getByRole('searchbox', { name: 'Search' }).fill('HQ')
  await expect(itemCard).toBeVisible()
  await page.getByRole('searchbox', { name: 'Search' }).fill('MG Road')
  await expect(itemCard).toBeVisible()
})

test('@visual authenticated home remains stable', async ({ page }) => {
  await openDemo(page)
  await page.addStyleTag({
    content: '.film-grain { display: none !important; } * { caret-color: transparent !important; }',
  })

  await expect(page.locator('main')).toHaveScreenshot('authenticated-home.png', {
    animations: 'disabled',
  })
})