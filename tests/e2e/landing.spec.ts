import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem('vault:landing-register:v1'))
  await page.goto('/')
})

test('files, recalls, and opens an entry', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Everything you meant to keep.' })).toBeVisible()

  const registerInput = page.getByPlaceholder('What do you not want to lose?')
  await registerInput.fill('The blue hour in Lisbon')
  await registerInput.press('Enter')
  await expect(page.getByRole('status').first()).toContainText('Entry filed as Lot 001.')

  const storedEntry = await page.evaluate(() => localStorage.getItem('vault:landing-register:v1'))
  expect(storedEntry).not.toBeNull()
  expect(JSON.parse(storedEntry as string)).toMatchObject({ title: 'The blue hour in Lisbon' })
  expect(JSON.parse(storedEntry as string).serial).toMatch(/^[0-9A-F]{6}$/)

  await page.getByRole('searchbox', { name: 'Search the catalogue' }).fill('Lisbon')
  await expect(page.locator('.search-ledger article')).toContainText('The blue hour in Lisbon')

  const firstDepartment = page.locator('.department-register details').first()
  await firstDepartment.locator('summary').focus()
  await firstDepartment.locator('summary').press('Enter')
  await expect(firstDepartment).toHaveAttribute('open', '')

  const openRegister = page.getByRole('button', { name: 'Open the register' })
  await openRegister.focus()
  await openRegister.press('Enter')
  await expect(page.getByRole('heading', { name: 'Sign-in is unavailable.' })).toBeVisible()
  await expect(page.locator('form')).toHaveCount(0)
})

test('has no automatically detectable WCAG violations', async ({ page }) => {
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
})

test('loads local plates and has no horizontal overflow', async ({ page }) => {
  const plateSources = ['/plates/ramen.webp', '/plates/lamp.webp', '/plates/place.webp']

  for (const source of plateSources) {
    const response = await page.request.get(source)
    expect(response.ok()).toBeTruthy()
  }

  await page.locator('.anatomy-plate').scrollIntoViewIfNeeded()
  await expect(page.locator('.anatomy-plate img')).toHaveJSProperty('complete', true)
  const imageWidth = await page.locator('.anatomy-plate img').evaluate((image: HTMLImageElement) => image.naturalWidth)
  expect(imageWidth).toBeGreaterThan(0)

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

test('@visual landing frontispiece and anatomy remain stable', async ({ page }) => {
  await page.addStyleTag({
    content: '.film-grain, .accession-progress { display: none !important; } * { caret-color: transparent !important; }',
  })
  await expect(page.locator('.accession-hero')).toHaveScreenshot('frontispiece.png')

  const anatomy = page.locator('.anatomy-frame')
  await anatomy.scrollIntoViewIfNeeded()
  await expect(anatomy).toHaveScreenshot('anatomy.png')
})