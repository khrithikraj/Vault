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

  const addItem = page.getByRole('button', { name: 'Add item' })
  await addItem.click()

  const editor = page.getByRole('dialog', { name: 'Note editor' })
  await expect(editor).toBeVisible()
  expect(await page.evaluate(() => window.history.state)).toEqual({ vaultOverlay: true })
  await expect(page.getByRole('button', { name: 'Close' })).toBeFocused()
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden')

  await page.keyboard.press('Escape')
  await expect(editor).toBeHidden()
  expect(await page.evaluate(() => window.history.state)).toEqual({ vaultSection: true })
  await expect(page.getByRole('button', { name: 'Add item' })).toBeAttached()
  await expect(page.locator('[inert]')).toHaveCount(0)
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible()
  await expect(addItem).toBeFocused()
})

test('document uploader uses the shared dialog contract', async ({ page }) => {
  await openDemo(page)
  await page.getByRole('button', { name: 'Documents' }).click()

  const addItem = page.getByRole('button', { name: 'Add item' })
  await addItem.click()

  const uploader = page.getByRole('dialog', { name: 'Add document' })
  const nameInput = page.getByLabel('Document name *')
  await expect(uploader).toBeVisible()
  await expect(nameInput).toBeFocused()
  await expect(nameInput).toHaveAttribute('required', '')
  await expect(page.getByRole('button', { name: 'Upload', exact: true })).toBeDisabled()
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden')

  await page.keyboard.press('Escape')
  await expect(uploader).toBeHidden()
  await expect(addItem).toBeFocused()
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
})

test('vault select supports keyboard navigation without closing its dialog', async ({ page }) => {
  await openDemo(page)
  await page.getByRole('button', { name: 'Documents' }).click()
  await page.getByRole('button', { name: 'Add item' }).click()

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
  await expect(sort).toHaveAttribute('aria-label', 'Sort by Newest')
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

test('capture title input keeps focus during continuous typing', async ({ page }) => {
  await openDemo(page)

  await page.getByRole('button', { name: 'Add item' }).click()
  await page.getByRole('menuitem', { name: /Item/ }).click()
  const capture = page.getByRole('dialog', { name: 'Add item' })
  await capture.getByRole('button', { name: 'Movies & Series' }).click()
  await capture.getByRole('button', { name: 'Skip →' }).click()

  // Real key presses — the input must keep focus (and the keyboard alive) so the
  // full phrase can be typed in one continuous pass without re-tapping the field.
  const title = capture.getByRole('textbox')
  await title.pressSequentially('Mai vaapus aavunaga', { delay: 25 })
  await expect(title).toHaveValue('Mai vaapus aavunaga')
  await expect(title).toBeFocused()

  await page.keyboard.press('Escape')
})

test('capture extraction image is not persisted unless added as a reference image', async ({ page }) => {
  // Real OCR is not the subject here — the persistence contract is. Stub the
  // OCR module *before navigating* so the real tesseract dependency never loads:
  // no CDN fetch, no uncaught worker error, no autofill. The extraction photo
  // still flows through every step of the wizard unchanged.
  await page.route('**/src/lib/screenshotAutofill.ts*', async (route) => {
    await route.fulfill({
      contentType: 'application/javascript',
      body: `
        export async function extractScreenshotText(file) {
          return { signature: 'stub:' + file.name, rawText: '', lines: [], confidence: 0 }
        }
        export function buildScreenshotAutofill(extraction, fields) {
          return { values: {}, matchedFields: [] }
        }
      `,
    })
  })

  await openDemo(page)

  // A 1x1 PNG — the extraction/screenshot input for OCR. The flow must treat it
  // as a temporary source image that never persists.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  )

  await page.getByRole('button', { name: 'Add item' }).click()
  await page.getByRole('menuitem', { name: /Item/ }).click()
  const capture = page.getByRole('dialog', { name: 'Add item' })
  await capture.getByRole('button', { name: 'Movies & Series' }).click()

  await capture.locator('input[type="file"]').setInputFiles({
    name: 'shot.png',
    mimeType: 'image/png',
    buffer: png,
  })
  await capture.getByRole('button', { name: 'Continue →' }).click()

  await capture.getByRole('textbox').fill('No Photo Film')
  // Advance through the optional fields: Genre → Platform → Reference Image →
  // Notes; the last field (Notes) shows "Review →".
  await capture.getByRole('button', { name: 'Continue →' }).click()
  await capture.getByRole('button', { name: 'Continue →' }).click()
  await capture.getByRole('button', { name: 'Continue →' }).click()
  // Reference Image is its own step (before Notes) and must not be pre-filled
  // with the extraction screenshot used for OCR.
  await expect(capture.getByRole('heading', { name: /> Reference Image/ })).toBeVisible()
  await expect(capture.getByRole('button', { name: 'Add image' })).toBeVisible()
  await expect(capture.locator('img[alt="Reference image preview"]')).toHaveCount(0)
  await capture.getByRole('button', { name: 'Continue →' }).click()
  await expect(capture.getByRole('heading', { name: /> Notes/ })).toBeVisible()
  await capture.getByRole('button', { name: 'Review →' }).click()

  // The review step must not duplicate the Reference Image UI or offer the
  // extraction screenshot as the saved photo.
  await expect(capture.getByRole('button', { name: 'Add image' })).toHaveCount(0)
  await expect(capture.locator('img[alt="Reference image preview"]')).toHaveCount(0)
  await expect(capture.locator('img[alt="Selected"]')).toHaveCount(0)

  await capture.getByRole('button', { name: 'Save to vault' }).click()
  await expect(capture).toBeHidden()

  const itemCard = page.getByRole('button', { name: 'No Photo Film, archived item' })
  await expect(itemCard).toBeVisible()
  await itemCard.click()
  const detail = page.getByRole('dialog', { name: 'Item details' })
  await expect(detail).toBeVisible()
  // The extraction/source image must not be stored or referenced on the item.
  await expect(detail.locator('img[alt="No Photo Film"]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Close item details' }).click()
})

test('capture reference image is persisted when explicitly added', async ({ page }) => {
  await openDemo(page)

  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  )

  await page.getByRole('button', { name: 'Add item' }).click()
  await page.getByRole('menuitem', { name: /Item/ }).click()
  const capture = page.getByRole('dialog', { name: 'Add item' })
  await capture.getByRole('button', { name: 'Movies & Series' }).click()
  await capture.getByRole('button', { name: 'Skip →' }).click()

  await capture.getByRole('textbox').fill('Has Photo Film')
  await capture.getByRole('button', { name: 'Continue →' }).click()
  await expect(capture.getByRole('heading', { name: /> Genre/ })).toBeVisible()
  await capture.getByRole('button', { name: 'Continue →' }).click()
  await expect(capture.getByRole('heading', { name: /> Platform/ })).toBeVisible()
  await capture.getByRole('button', { name: 'Continue →' }).click()
  await expect(capture.getByRole('heading', { name: /> Reference Image/ })).toBeVisible()

  // Deliberately choose a reference image on its dedicated step
  await capture.locator('input[type="file"]').setInputFiles({
    name: 'reference.png',
    mimeType: 'image/png',
    buffer: png,
  })
  await expect(capture.locator('img[alt="Reference image preview"]')).toBeVisible()

  // Back from Reference Image returns to the previous field, and the selected
  // image survives forward navigation.
  await capture.getByRole('button', { name: '[ ← Back ]' }).click()
  await expect(capture.getByRole('heading', { name: /> Platform/ })).toBeVisible()
  await capture.getByRole('button', { name: 'Continue →' }).click()
  await expect(capture.getByRole('heading', { name: /> Reference Image/ })).toBeVisible()
  await expect(capture.locator('img[alt="Reference image preview"]')).toBeVisible()

  await capture.getByRole('button', { name: 'Continue →' }).click()
  await expect(capture.getByRole('heading', { name: /> Notes/ })).toBeVisible()
  await capture.getByRole('button', { name: 'Review →' }).click()

  await capture.getByRole('button', { name: 'Save to vault' }).click()
  await expect(capture).toBeHidden()

  const itemCard = page.getByRole('button', { name: 'Has Photo Film, archived item' })
  await expect(itemCard).toBeVisible()
  await itemCard.click()
  const detail = page.getByRole('dialog', { name: 'Item details' })
  await expect(detail).toBeVisible()
  await expect(detail.locator('img[alt="Has Photo Film"]')).toBeVisible()
  await page.getByRole('button', { name: 'Close item details' }).click()
})

test('capture wizard runs Reference Image as its own step before Notes', async ({ page }) => {
  await openDemo(page)

  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  )

  await page.getByRole('button', { name: 'Add item' }).click()
  await page.getByRole('menuitem', { name: /Item/ }).click()
  const capture = page.getByRole('dialog', { name: 'Add item' })
  const progress = page.getByRole('progressbar', { name: 'Add item progress' })

  await capture.getByRole('button', { name: 'Food Spots' }).click()
  await capture.getByRole('button', { name: 'Skip →' }).click()
  // Food Spots order: Category → Screenshot → Place name → Dish → Address →
  // Price → Reference Image → Notes → Review. The reference step is a real step.
  await expect(progress).toHaveAttribute('aria-valuemax', '9')
  await expect(progress).toHaveAttribute('aria-valuenow', '3')

  await capture.getByRole('textbox').fill('Order Cafe')
  await capture.getByRole('button', { name: 'Continue →' }).click()
  await expect(capture.getByRole('heading', { name: /> Dish to try/ })).toBeVisible()
  await capture.getByRole('textbox').fill('Thali')
  await capture.getByRole('button', { name: 'Continue →' }).click()
  await expect(capture.getByRole('heading', { name: /> Address/ })).toBeVisible()
  await capture.getByRole('button', { name: 'Continue →' }).click()
  await expect(capture.getByRole('heading', { name: /> Price/ })).toBeVisible()
  await capture.getByRole('button', { name: 'Continue →' }).click()

  // Reference Image is before Notes, marked Optional, and a counted step.
  await expect(capture.getByRole('heading', { name: /> Reference Image/ })).toBeVisible()
  await expect(capture.getByText('Optional', { exact: true })).toBeVisible()
  await expect(progress).toHaveAttribute('aria-valuenow', '7')

  // Back from Reference Image returns to the previous field step…
  await capture.getByRole('button', { name: '[ ← Back ]' }).click()
  await expect(capture.getByRole('heading', { name: /> Price/ })).toBeVisible()
  await expect(progress).toHaveAttribute('aria-valuenow', '6')
  // …and Continue returns here.
  await capture.getByRole('button', { name: 'Continue →' }).click()
  await expect(capture.getByRole('heading', { name: /> Reference Image/ })).toBeVisible()

  // Explicitly selected image survives moving through the wizard.
  await capture.locator('input[type="file"]').setInputFiles({
    name: 'reference.png',
    mimeType: 'image/png',
    buffer: png,
  })
  await expect(capture.locator('img[alt="Reference image preview"]')).toBeVisible()

  await capture.getByRole('button', { name: 'Continue →' }).click()
  await expect(capture.getByRole('heading', { name: /> Notes/ })).toBeVisible()
  await expect(progress).toHaveAttribute('aria-valuenow', '8')
  await capture.getByRole('textbox').fill('Great thali')

  // Back from Notes returns to Reference Image with the selection intact.
  await capture.getByRole('button', { name: '[ ← Back ]' }).click()
  await expect(capture.getByRole('heading', { name: /> Reference Image/ })).toBeVisible()
  await expect(capture.locator('img[alt="Reference image preview"]')).toBeVisible()
  await capture.getByRole('button', { name: 'Continue →' }).click()
  await expect(capture.getByRole('textbox')).toHaveValue('Great thali')

  await capture.getByRole('button', { name: 'Review →' }).click()
  // Review summarizes the fields without duplicating the Reference Image UI.
  await expect(progress).toHaveAttribute('aria-valuenow', '9')
  await expect(capture.getByRole('button', { name: 'Add image' })).toHaveCount(0)
  await capture.getByRole('button', { name: 'Save to vault' }).click()
  await expect(capture).toBeHidden()

  const itemCard = page.getByRole('button', { name: 'Order Cafe, archived item' })
  await expect(itemCard).toBeVisible()
  await itemCard.click()
  const detail = page.getByRole('dialog', { name: 'Item details' })
  await expect(detail).toBeVisible()
  await expect(detail.locator('img[alt="Order Cafe"]')).toBeVisible()
  await page.getByRole('button', { name: 'Close item details' }).click()
})

test('capture wizard lets the Reference Image step be skipped without persisting an image', async ({ page }) => {
  await openDemo(page)

  await page.getByRole('button', { name: 'Add item' }).click()
  await page.getByRole('menuitem', { name: /Item/ }).click()
  const capture = page.getByRole('dialog', { name: 'Add item' })
  await capture.getByRole('button', { name: 'Movies & Series' }).click()
  await capture.getByRole('button', { name: 'Skip →' }).click()

  await capture.getByRole('textbox').fill('No Image Film')
  await capture.getByRole('button', { name: 'Continue →' }).click()
  await capture.getByRole('button', { name: 'Continue →' }).click()
  await capture.getByRole('button', { name: 'Continue →' }).click()

  // Skipping Reference Image still lands on Notes with nothing selected.
  await expect(capture.getByRole('heading', { name: /> Reference Image/ })).toBeVisible()
  await expect(capture.locator('img[alt="Reference image preview"]')).toHaveCount(0)
  await capture.getByRole('button', { name: 'Continue →' }).click()
  await expect(capture.getByRole('heading', { name: /> Notes/ })).toBeVisible()
  await capture.getByRole('button', { name: 'Review →' }).click()
  await expect(capture.getByRole('button', { name: 'Add image' })).toHaveCount(0)

  await capture.getByRole('button', { name: 'Save to vault' }).click()
  await expect(capture).toBeHidden()

  const itemCard = page.getByRole('button', { name: 'No Image Film, archived item' })
  await expect(itemCard).toBeVisible()
  await itemCard.click()
  const detail = page.getByRole('dialog', { name: 'Item details' })
  await expect(detail).toBeVisible()
  // No reference image was selected, so nothing should be stored.
  await expect(detail.locator('img[alt="No Image Film"]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Close item details' }).click()
})

test('capture reference image step stays overflow-free across narrow mobile widths', async ({ page }) => {
  await openDemo(page)

  for (const viewport of NARROW_MOBILE_VIEWPORTS) {
    await page.setViewportSize(viewport)
    // Each iteration walks the wizard fresh — don't let an earlier draft resume it.
    await page.evaluate(() => window.sessionStorage.removeItem('vault:captureDraft'))

    await page.getByRole('button', { name: 'Add item' }).click()
    await page.getByRole('menuitem', { name: /Item/ }).click()
    const capture = page.getByRole('dialog', { name: 'Add item' })
    await capture.getByRole('button', { name: 'Movies & Series' }).click()
    await capture.getByRole('button', { name: 'Skip →' }).click()
    await capture.getByRole('textbox').fill('Mobile Reference')
    // Wait for each step's heading between clicks so the AnimatePresence
    // transition settles — rapid clicks can otherwise land one step short.
    await capture.getByRole('button', { name: 'Continue →' }).click()
    await expect(capture.getByRole('heading', { name: /> Genre/ })).toBeVisible()
    await capture.getByRole('button', { name: 'Continue →' }).click()
    await expect(capture.getByRole('heading', { name: /> Platform/ })).toBeVisible()
    await capture.getByRole('button', { name: 'Continue →' }).click()
    await expect(capture.getByRole('heading', { name: /> Reference Image/ })).toBeVisible()
    let overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, `reference step overflow at ${viewport.width}px`).toBeLessThanOrEqual(0)
    await expect(capture.getByRole('button', { name: 'Continue →' })).toBeVisible()

    await capture.getByRole('button', { name: 'Continue →' }).click()
    await expect(capture.getByRole('heading', { name: /> Notes/ })).toBeVisible()
    overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, `notes overflow at ${viewport.width}px`).toBeLessThanOrEqual(0)

    await page.keyboard.press('Escape')
  }
})

test('checklist reorder mode toggles drag handles and keeps contextual actions', async ({ page }) => {
  await openDemo(page)
  await page.getByRole('button', { name: 'Notes' }).click()
  await page.getByRole('button', { name: 'Add item' }).click()

  const editor = page.getByRole('dialog', { name: 'Note editor' })
  const newTask = editor.getByPlaceholder('Add new task or list item...')
  await newTask.fill('First chore')
  await editor.getByRole('button', { name: 'Add', exact: true }).click()
  await newTask.fill('Second chore')
  await editor.getByRole('button', { name: 'Add', exact: true }).click()

  // Normal compact row: no drag handle; a single ⋯ contextual action per row.
  await expect(editor.getByRole('button', { name: 'Drag to reorder' })).toHaveCount(0)
  await expect(editor.getByRole('button', { name: 'More actions for First chore' })).toBeVisible()

  // Enter Reorder mode: handles appear, secondary row controls step aside.
  await editor.getByRole('button', { name: 'Reorder', exact: true }).click()
  await expect(editor.getByRole('button', { name: 'Drag to reorder' })).toHaveCount(2)
  await expect(editor.getByRole('button', { name: 'More actions for First chore' })).toHaveCount(0)

  // Exit Reorder mode: compact rows return.
  await editor.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(editor.getByRole('button', { name: 'Drag to reorder' })).toHaveCount(0)
  await expect(editor.getByRole('button', { name: 'More actions for First chore' })).toBeVisible()

  // Delete through the contextual ⋯ menu.
  await editor.getByRole('button', { name: 'More actions for First chore' }).click()
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  await expect(editor.locator('input[value="First chore"]')).toHaveCount(0)
  await expect(editor.locator('input[value="Second chore"]')).toBeVisible()
})

/** The phones this regression targets — portrait 320–412px plus narrow landscape. */
const NARROW_MOBILE_VIEWPORTS = [
  { width: 320, height: 780 },
  { width: 360, height: 780 },
  { width: 375, height: 780 },
  { width: 390, height: 780 },
  { width: 412, height: 780 },
  { width: 740, height: 360 },
  { width: 844, height: 390 },
]

test('capture title stays continuously focusable while typing across narrow mobile widths', async ({ page }) => {
  await openDemo(page)

  for (const viewport of NARROW_MOBILE_VIEWPORTS) {
    await page.setViewportSize(viewport)
    // Each iteration types fresh — don't let an earlier draft resume the wizard.
    await page.evaluate(() => window.sessionStorage.removeItem('vault:captureDraft'))

    await page.getByRole('button', { name: 'Add item' }).click()
    await page.getByRole('menuitem', { name: /Item/ }).click()
    const capture = page.getByRole('dialog', { name: 'Add item' })
    await capture.getByRole('button', { name: 'Movies & Series' }).click()
    await capture.getByRole('button', { name: 'Skip →' }).click()

    const title = capture.getByRole('textbox')
    await title.pressSequentially('Mai vaapus aavunaga', { delay: 15 })
    await expect(title).toHaveValue('Mai vaapus aavunaga')
    await expect(title).toBeFocused()

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, `horizontal overflow at ${viewport.width}px`).toBeLessThanOrEqual(0)

    await page.keyboard.press('Escape')
  }
})

test('checklist rows stay compact and overflow-free across narrow mobile widths', async ({ page }) => {
  await openDemo(page)

  for (const viewport of NARROW_MOBILE_VIEWPORTS) {
    await page.setViewportSize(viewport)
    await page.getByRole('button', { name: 'Notes' }).click()
    await page.getByRole('button', { name: 'Add item' }).click()

    const editor = page.getByRole('dialog', { name: 'Note editor' })
    const newTask = editor.getByPlaceholder('Add new task or list item...')
    await newTask.fill('Hose Pipe')
    await editor.getByRole('button', { name: 'Add', exact: true }).click()
    await newTask.fill('A much longer checklist task name')
    await editor.getByRole('button', { name: 'Add', exact: true }).click()

    // Normal row: a checkbox, roomy task text, and exactly one ⋯ — no drag handle.
    await expect(editor.getByRole('button', { name: 'Drag to reorder' })).toHaveCount(0)
    const check = editor.getByRole('checkbox').first()
    const text = editor.locator('input[value="Hose Pipe"]')
    const more = editor.getByRole('button', { name: 'More actions for Hose Pipe' })
    await expect(check).toBeVisible()
    await expect(text).toBeVisible()
    await expect(more).toBeVisible()

    const checkBox = await check.boundingBox()
    const textBox = await text.boundingBox()
    const moreBox = await more.boundingBox()
    if (!checkBox || !textBox || !moreBox) {
      throw new Error(`Row geometry missing at ${viewport.width}px`)
    }
    // Text sits between the checkbox and the ⋯ with no overlap…
    expect(textBox.x).toBeGreaterThanOrEqual(checkBox.x + checkBox.width)
    expect(textBox.x + textBox.width).toBeLessThanOrEqual(moreBox.x)
    // …and every control that must stay visible stays inside the viewport.
    expect(checkBox.x).toBeGreaterThanOrEqual(0)
    expect(moreBox.x + moreBox.width, `⋯ pushed off-screen at ${viewport.width}px`).toBeLessThanOrEqual(
      viewport.width,
    )
    // At 320px the note dialog shell leaves the row ~206px wide; a mid-length task
    // needs only ~60px, so a ≥80px text column is comfortably usable without the
    // controls crowding it (inline reminder/delete buttons would drop it below this).
    expect(textBox.width).toBeGreaterThan(80)

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, `horizontal overflow at ${viewport.width}px`).toBeLessThanOrEqual(0)

    await page.keyboard.press('Escape')
  }
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
  await expect(capture.getByRole('heading', { name: /> Reference Image/ })).toBeVisible()
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

  const deleteItem = detail.getByRole('button', { name: 'More actions' })
  await deleteItem.click()
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  const confirmation = page.getByRole('dialog', { name: 'Move to trash?' })
  await expect(confirmation).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(confirmation).toBeHidden()
  await expect(detail).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(detail).toBeHidden()
  await expect(itemCard).toBeFocused()
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')

  await itemCard.getByRole('button', { name: 'Delete Phase Two Cafe' }).click()
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
  await page.getByRole('button', { name: 'Add item' }).click()

  const editor = page.getByRole('dialog', { name: 'Note editor' })

  // Note-level reminder (surfaced through the overflow menu)
  const moreActions = editor.getByRole('button', { name: 'More actions', exact: true })
  await moreActions.click()
  await page.getByRole('menuitem', { name: 'Reminder', exact: true }).click()
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
  await expect(reminderDialog).toBeHidden()
  await moreActions.click()
  await expect(page.getByRole('menuitem', { name: /Weekdays · 09:46 AM/i })).toBeVisible()
  await page.keyboard.press('Escape')

  // Clean checklist row and strikethrough
  await editor.getByPlaceholder('Add new task or list item...').fill('DSA practice')
  await editor.getByRole('button', { name: 'Add', exact: true }).click()
  const itemInput = editor.locator('input[value="DSA practice"]')
  await expect(itemInput).toBeVisible()

  // Item-level reminder lives in the row's contextual ⋯ menu
  const itemMore = editor.getByRole('button', { name: 'More actions for DSA practice' })
  await expect(itemMore).toBeVisible()
  await itemMore.click()
  await page.getByRole('menuitem', { name: 'Set reminder' }).click()

  const itemReminderDialog = page.getByRole('dialog', { name: 'Reminder settings' })
  await expect(itemReminderDialog).toBeVisible()
  await expectDialogContainedInViewport(page, itemReminderDialog)
  await expect(itemReminderDialog.getByText('DSA practice')).toBeVisible()

  // Set 01:00 PM via the time fields and save
  await itemReminderDialog.getByRole('textbox', { name: 'Hour' }).fill('01')
  await itemReminderDialog.getByRole('textbox', { name: 'Minute' }).fill('00')
  await itemReminderDialog.getByRole('button', { name: 'PM', exact: true }).click()
  await expect(itemReminderDialog.getByText('01:00 PM')).toBeVisible()
  await itemReminderDialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(editor.locator('[title="Daily reminder at 01:00 PM"]')).toBeVisible()

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
  await expect(capture.getByRole('heading', { name: /> Reference Image/ })).toBeVisible()
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
  await expect(capture.getByRole('heading', { name: /> Reference Image/ })).toBeVisible()
  await capture.getByRole('button', { name: 'Continue →' }).click()
  await expect(capture.getByRole('heading', { name: /> Notes/ })).toBeVisible()
  await capture.getByRole('button', { name: 'Review →' }).click()
  await capture.getByRole('button', { name: 'Save to vault' }).click()

  const itemCard = page.getByRole('button', { name: 'Noodle Bar, archived item' })
  await page.getByRole('button', { name: 'Add Noodle Bar to favorites' }).click()

  await page.getByRole('button', { name: 'Notes' }).click()
  await page.getByRole('button', { name: 'Add item' }).click()
  const editor = page.getByRole('dialog', { name: 'Note editor' })
  await editor.getByPlaceholder('Note title...').fill('Stretching habit')
  await page.waitForTimeout(800)
  await editor.getByRole('button', { name: 'Close', exact: true }).click()
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
  await expect(capture.getByRole('heading', { name: /> Reference Image/ })).toBeVisible()
  await capture.getByRole('button', { name: 'Continue →' }).click()
  await expect(capture.getByRole('heading', { name: /> Notes/ })).toBeVisible()
  await capture.getByRole('button', { name: 'Review →' }).click()
  await capture.getByRole('button', { name: 'Save to vault' }).click()

  const itemCard = page.getByRole('button', { name: 'Favorite Keeper, archived item' })
  await page.getByRole('button', { name: 'Add Favorite Keeper to favorites' }).click()

  await itemCard.getByRole('button', { name: 'Delete Favorite Keeper' }).click()
  await expect(itemCard).toBeHidden()
  await page.getByRole('button', { name: 'Favorites', exact: true }).click()
  await expect(page.getByText('No favorites yet')).toBeVisible()

  await page.getByRole('button', { name: 'Trash' }).click()
  await page.getByRole('button', { name: 'Restore item' }).click()
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
  await expect(capture.getByRole('heading', { name: /> Reference Image/ })).toBeVisible()
  await capture.getByRole('button', { name: 'Continue →' }).click()
  await expect(capture.getByRole('heading', { name: /> Notes/ })).toBeVisible()
  await capture.getByRole('button', { name: 'Review →' }).click()
  await capture.getByRole('button', { name: 'Save to vault' }).click()

  const itemCard = page.getByRole('button', { name: 'Legacy Cafe, archived item' })
  await itemCard.click()
  const detail = page.getByRole('dialog', { name: 'Item details' })
  await expect(detail.getByText('MG Road', { exact: true }).first()).toBeVisible()
  await expect(detail.getByText('Legacy Cafe', { exact: true }).first()).toBeVisible()

  await detail.getByRole('button', { name: 'More actions for Legacy Cafe' }).click()
  await page.getByRole('menuitem', { name: 'Edit branch' }).click()
  await detail.getByLabel('Branch name').fill('HQ')
  await detail.getByRole('button', { name: 'Save branch' }).click()
  await expect(detail.getByText('HQ', { exact: true })).toBeVisible()
  await expect(detail.getByText('MG Road', { exact: true }).first()).toBeVisible()

  await detail.getByRole('button', { name: 'Add branch' }).click()
  await detail.getByLabel('Branch name').fill('Kukatpally')
  await detail.getByLabel('Branch address').fill('Highway Rd')
  await detail.getByRole('button', { name: 'Save branch' }).click()
  await expect(detail.getByText('Highway Rd', { exact: true })).toBeVisible()

  await detail.getByRole('button', { name: 'More actions for Kukatpally' }).click()
  await page.getByRole('menuitem', { name: 'Delete branch' }).click()
  await expect(detail.getByText('Kukatpally', { exact: true })).toHaveCount(0)
  await expect(detail.getByText('Highway Rd', { exact: true })).toHaveCount(0)
  await expect(detail.getByText('HQ', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Close item details' }).click()
  await page.getByRole('searchbox', { name: 'Search' }).fill('HQ')
  await expect(itemCard).toBeVisible()
  await page.getByRole('searchbox', { name: 'Search' }).fill('MG Road')
  await expect(itemCard).toBeVisible()
})

/** Two distinct PNGs so the rendered previews can be told apart by size:
 *  the OCR/extraction source is 1×1 (naturalWidth 1), the deliberately chosen
 *  reference image is 2×2 (naturalWidth 2). */
const PNG_SOURCE_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)
const PNG_REFERENCE_2PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEUlEQVR4nGP4z8DwnwGMgRQAH+4D/dJQfRoAAAAASUVORK5CYII=',
  'base64',
)

test('capture review preview shows the selected reference image, never the OCR source', async ({ page }) => {
  // Stub OCR before navigating so no real tesseract/CDN loads: the extraction
  // photo still flows through the wizard as the temporary screenshot input.
  await page.route('**/src/lib/screenshotAutofill.ts*', async (route) => {
    await route.fulfill({
      contentType: 'application/javascript',
      body: `
        export async function extractScreenshotText(file) {
          return { signature: 'stub:' + file.name, rawText: '', lines: [], confidence: 0 }
        }
        export function buildScreenshotAutofill(extraction, fields) {
          return { values: {}, matchedFields: [] }
        }
      `,
    })
  })

  await openDemo(page)

  await page.getByRole('button', { name: 'Add item' }).click()
  await page.getByRole('menuitem', { name: /Item/ }).click()
  const capture = page.getByRole('dialog', { name: 'Add item' })
  await capture.getByRole('button', { name: 'Movies & Series' }).click()

  // 1×1 OCR/extraction source image — a temporary screenshot, not the item photo.
  await capture.locator('input[type="file"]').setInputFiles({
    name: 'shot.png',
    mimeType: 'image/png',
    buffer: PNG_SOURCE_1PX,
  })
  await capture.getByRole('button', { name: 'Continue →' }).click()

  await capture.getByRole('textbox').fill('Split Image Film')
  await capture.getByRole('button', { name: 'Continue →' }).click()
  await expect(capture.getByRole('heading', { name: /> Genre/ })).toBeVisible()
  await capture.getByRole('button', { name: 'Continue →' }).click()
  await expect(capture.getByRole('heading', { name: /> Platform/ })).toBeVisible()
  await capture.getByRole('button', { name: 'Continue →' }).click()
  await expect(capture.getByRole('heading', { name: /> Reference Image/ })).toBeVisible()

  // Deliberately select a DIFFERENT image (2×2) as the reference image.
  await capture.locator('input[type="file"]').setInputFiles({
    name: 'reference.png',
    mimeType: 'image/png',
    buffer: PNG_REFERENCE_2PX,
  })
  const referencePreview = capture.locator('img[alt="Reference image preview"]')
  await expect(referencePreview).toBeVisible()
  await expect(referencePreview).toHaveJSProperty('naturalWidth', 2)
  // The OCR source is never substituted onto the reference step.
  await expect(capture.locator('img[alt="Selected"]')).toHaveCount(0)

  await capture.getByRole('button', { name: 'Continue →' }).click()
  await expect(capture.getByRole('heading', { name: /> Notes/ })).toBeVisible()
  await capture.getByRole('button', { name: 'Review →' }).click()

  // Review shows the selected 2×2 reference image — NOT the 1×1 OCR source.
  await expect(referencePreview).toBeVisible()
  await expect(referencePreview).toHaveJSProperty('naturalWidth', 2)
  await expect(capture.locator('img[alt="Selected"]')).toHaveCount(0)

  await capture.getByRole('button', { name: 'Save to vault' }).click()
  await expect(capture).toBeHidden()

  // The persisted reference image matches the explicitly selected one.
  const itemCard = page.getByRole('button', { name: 'Split Image Film, archived item' })
  await expect(itemCard).toBeVisible()
  await itemCard.click()
  const detail = page.getByRole('dialog', { name: 'Item details' })
  await expect(detail).toBeVisible()
  const detailImage = detail.locator('img[alt="Split Image Film"]')
  await expect(detailImage).toBeVisible()
  await expect(detailImage).toHaveJSProperty('naturalWidth', 2)
  await page.getByRole('button', { name: 'Close item details' }).click()
})

test('capture review keeps the selected reference image visible and overflow-free across narrow widths', async ({
  page,
}) => {
  await openDemo(page)

  for (const viewport of NARROW_MOBILE_VIEWPORTS) {
    await page.setViewportSize(viewport)
    // Fresh wizard each iteration — don't let an earlier draft resume.
    await page.evaluate(() => window.sessionStorage.removeItem('vault:captureDraft'))

    await page.getByRole('button', { name: 'Add item' }).click()
    await page.getByRole('menuitem', { name: /Item/ }).click()
    const capture = page.getByRole('dialog', { name: 'Add item' })
    await capture.getByRole('button', { name: 'Movies & Series' }).click()
    await capture.getByRole('button', { name: 'Skip →' }).click()
    await capture.getByRole('textbox').fill('Mobile Review Image')
    await capture.getByRole('button', { name: 'Continue →' }).click()
    await expect(capture.getByRole('heading', { name: /> Genre/ })).toBeVisible()
    await capture.getByRole('button', { name: 'Continue →' }).click()
    await expect(capture.getByRole('heading', { name: /> Platform/ })).toBeVisible()
    await capture.getByRole('button', { name: 'Continue →' }).click()
    await expect(capture.getByRole('heading', { name: /> Reference Image/ })).toBeVisible()
    await capture.locator('input[type="file"]').setInputFiles({
      name: 'reference.png',
      mimeType: 'image/png',
      buffer: PNG_REFERENCE_2PX,
    })
    const referencePreview = capture.locator('img[alt="Reference image preview"]')
    await expect(referencePreview).toBeVisible()

    // Back to Reference Image and forward again — the selection survives.
    await capture.getByRole('button', { name: 'Continue →' }).click()
    await expect(capture.getByRole('heading', { name: /> Notes/ })).toBeVisible()
    await capture.getByRole('button', { name: '[ ← Back ]' }).click()
    await expect(capture.getByRole('heading', { name: /> Reference Image/ })).toBeVisible()
    await expect(referencePreview).toBeVisible()
    await capture.getByRole('button', { name: 'Continue →' }).click()
    await expect(capture.getByRole('heading', { name: /> Notes/ })).toBeVisible()

    // The same selected image appears on Review with no OCR fallback.
    await capture.getByRole('button', { name: 'Review →' }).click()
    await expect(referencePreview).toBeVisible()
    await expect(referencePreview).toHaveJSProperty('naturalWidth', 2)
    await expect(capture.locator('img[alt="Selected"]')).toHaveCount(0)

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, `review overflow at ${viewport.width}px`).toBeLessThanOrEqual(0)
    const dialogBox = await page.evaluate(() => {
      const dialog = document.querySelector('[aria-label="Add item"]')
      if (!dialog) return null
      return { scrollWidth: dialog.scrollWidth, clientWidth: dialog.clientWidth }
    })
    expect(dialogBox, `review dialog missing at ${viewport.width}px`).not.toBeNull()
    expect(dialogBox!.scrollWidth, `review dialog overflow at ${viewport.width}px`).toBeLessThanOrEqual(
      dialogBox!.clientWidth + 1,
    )

    const imgBox = await referencePreview.boundingBox()
    if (!imgBox) throw new Error(`Review image missing at ${viewport.width}px`)
    expect(imgBox.width).toBeGreaterThan(0)
    expect(imgBox.height).toBeGreaterThan(0)

    await page.keyboard.press('Escape')
  }
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