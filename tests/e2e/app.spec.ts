import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

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

test('@visual authenticated home remains stable', async ({ page }) => {
  await openDemo(page)
  await page.addStyleTag({
    content: '.film-grain { display: none !important; } * { caret-color: transparent !important; }',
  })

  await expect(page.locator('main')).toHaveScreenshot('authenticated-home.png', {
    animations: 'disabled',
  })
})