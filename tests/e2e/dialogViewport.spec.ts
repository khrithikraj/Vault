import { expect, test, type Page } from '@playwright/test'

/**
 * Dialog viewport contract — regression guard for the soft-keyboard bug.
 *
 * On Android 15+ the platform enforces edge-to-edge for apps that target SDK
 * 35, so `adjustResize` no longer resizes the window for the keyboard. The
 * native layer now shrinks the Capacitor WebView by the IME inset, which makes
 * the web viewport shorter exactly like a real keyboard does. These tests
 * emulate that by shrinking the browser viewport while a dialog is open.
 *
 * The shared VaultDialog owns the layout: the panel is capped by the space
 * that is on screen, the header and footer never move, and the body is the
 * only scrolling region.
 */

const KEYBOARD_VIEWPORT = { width: 390, height: 360 }

async function openDemo(page: Page) {
  page.on('pageerror', (error) => { throw error })
  await page.addInitScript(() => window.localStorage.setItem('vault:onboardingSeen', '1'))
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Sign-in is unavailable.' })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Open demo' }).click()
  await expect(page.getByRole('heading', { name: 'All items' })).toBeVisible({ timeout: 15_000 })
}

type DialogMetrics = {
  panel: { top: number; bottom: number } | null
  body: { clientHeight: number; scrollHeight: number; scrollTop: number; overflowY: string } | null
  overlay: { clientHeight: number; scrollHeight: number } | null
}

async function readDialogMetrics(page: Page): Promise<DialogMetrics> {
  return page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('[data-dialog-panel]')
    const body = document.querySelector<HTMLElement>('[data-dialog-body]')
    const overlay = panel?.parentElement ?? null
    const rect = panel?.getBoundingClientRect()
    return {
      panel: rect ? { top: rect.top, bottom: rect.bottom } : null,
      body: body
        ? {
            clientHeight: body.clientHeight,
            scrollHeight: body.scrollHeight,
            scrollTop: body.scrollTop,
            overflowY: getComputedStyle(body).overflowY,
          }
        : null,
      overlay: overlay
        ? { clientHeight: overlay.clientHeight, scrollHeight: overlay.scrollHeight }
        : null,
    }
  })
}

/**
 * The shared dialog contract, checked against the live layout:
 * the panel is capped by the visible height, the overlay never scrolls,
 * and the body is the only scrolling region.
 */
async function expectKeyboardSafeDialog(page: Page) {
  await expect
    .poll(
      async () => {
        const m = await readDialogMetrics(page)
        if (!m.panel || !m.body || !m.overlay) return false
        return (
          m.panel.top >= -1 &&
          m.panel.bottom <= KEYBOARD_VIEWPORT.height + 1 &&
          m.overlay.scrollHeight <= m.overlay.clientHeight + 1 &&
          m.body.overflowY === 'auto' &&
          m.body.clientHeight > 0
        )
      },
      {
        timeout: 10_000,
        message:
          'dialog panel must be capped by the visible height with a scrollable body (keyboard-safe layout)',
      },
    )
    .toBe(true)
}

async function scrollDialogBodyToBottom(page: Page) {
  await page.evaluate(() => {
    const body = document.querySelector<HTMLElement>('[data-dialog-body]')
    if (body) body.scrollTop = body.scrollHeight
  })
}

/**
 * After scrolling the body to the bottom, the last rendered element of the
 * body must sit inside the visible part of the body — that is what proves the
 * whole form is reachable with the keyboard open.
 */
async function readLastReachableElement(page: Page) {
  return page.evaluate(() => {
    const body = document.querySelector<HTMLElement>('[data-dialog-body]')
    if (!body) return null
    const bodyRect = body.getBoundingClientRect()
    const rendered = Array.from(body.querySelectorAll<HTMLElement>('*')).filter((el) => {
      const rect = el.getBoundingClientRect()
      return rect.height > 0 && rect.width > 0
    })
    const last = rendered[rendered.length - 1]
    if (!last) return null
    const rect = last.getBoundingClientRect()
    return {
      bodyTop: bodyRect.top,
      bodyBottom: bodyRect.bottom,
      lastTop: rect.top,
      lastBottom: rect.bottom,
      lastText: (last.textContent || '').trim().slice(0, 40),
    }
  })
}

test('reminder editor keeps its header and footer usable when the keyboard shrinks the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 })
  await openDemo(page)

  await page.getByRole('button', { name: 'Add item' }).click()
  await page.getByRole('menuitem', { name: /Reminder/i }).click()

  const dialog = page.getByRole('dialog', { name: 'New Reminder' })
  await expect(dialog).toBeVisible({ timeout: 10_000 })

  // The keyboard takes the lower half of the screen; the web viewport shrinks
  // to what is left, exactly like the native IME inset handling does.
  await page.setViewportSize(KEYBOARD_VIEWPORT)
  await expect(dialog).toBeVisible()
  await expectKeyboardSafeDialog(page)

  const metrics = await readDialogMetrics(page)
  expect(metrics.panel).not.toBeNull()
  expect(metrics.body).not.toBeNull()
  expect(metrics.overlay).not.toBeNull()

  // The panel is capped by the visible height - it never runs under the keyboard.
  expect(metrics.panel!.top).toBeGreaterThanOrEqual(-1)
  expect(metrics.panel!.bottom).toBeLessThanOrEqual(KEYBOARD_VIEWPORT.height + 1)

  // The overlay itself must not scroll: the dialog body owns the scrolling.
  expect(metrics.overlay!.scrollHeight).toBeLessThanOrEqual(metrics.overlay!.clientHeight + 1)

  // The body is the scroll region and it genuinely overflows at this height.
  expect(metrics.body!.overflowY).toBe('auto')
  expect(metrics.body!.clientHeight).toBeGreaterThan(0)
  expect(metrics.body!.scrollHeight).toBeGreaterThan(metrics.body!.clientHeight)

  // Header and footer stay on screen.
  await expect(dialog.getByRole('heading', { name: 'New Reminder' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: /Create Reminder/i })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible()

  // Scrolling the body brings the last field into the visible area and the
  // footer actions stay put.
  await scrollDialogBodyToBottom(page)
  const scrolled = await readDialogMetrics(page)
  expect(scrolled.body!.scrollTop).toBeGreaterThan(0)

  const last = await readLastReachableElement(page)
  expect(last).not.toBeNull()
  expect(last!.lastTop).toBeGreaterThanOrEqual(last!.bodyTop - 1)
  expect(last!.lastBottom).toBeLessThanOrEqual(last!.bodyBottom + 1)

  await expect(dialog.getByRole('button', { name: /Create Reminder/i })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible()
})

test('note editor body scrolls instead of hiding content behind the keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 })
  await openDemo(page)

  await page.getByRole('button', { name: 'Notes' }).click()
  await page.getByRole('button', { name: 'Add item' }).click()

  const dialog = page.getByRole('dialog', { name: 'Note editor' })
  await expect(dialog).toBeVisible({ timeout: 10_000 })

  await page.setViewportSize(KEYBOARD_VIEWPORT)
  await expect(dialog).toBeVisible()
  await expectKeyboardSafeDialog(page)

  const metrics = await readDialogMetrics(page)
  expect(metrics.panel).not.toBeNull()
  expect(metrics.panel!.top).toBeGreaterThanOrEqual(-1)
  expect(metrics.panel!.bottom).toBeLessThanOrEqual(KEYBOARD_VIEWPORT.height + 1)
  expect(metrics.overlay!.scrollHeight).toBeLessThanOrEqual(metrics.overlay!.clientHeight + 1)

  expect(metrics.body!.overflowY).toBe('auto')
  expect(metrics.body!.clientHeight).toBeGreaterThan(0)

  // The close control stays reachable above the keyboard.
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeVisible()

  // Long content is reachable by scrolling the body.
  const editorBody = dialog.getByPlaceholder('Write anything down (ideas, markdown, reminders, lists)...')
  await editorBody.fill(
    Array.from({ length: 30 }, (_, i) => `Paragraph ${i + 1} with some line content.`).join('\n\n'),
  )
  const filled = await readDialogMetrics(page)
  expect(filled.body!.scrollHeight).toBeGreaterThan(filled.body!.clientHeight)

  await scrollDialogBodyToBottom(page)
  const scrolled = await readDialogMetrics(page)
  expect(scrolled.body!.scrollTop).toBeGreaterThan(0)
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeVisible()
})

test('add item sheet stays inside the keyboard-sized viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 })
  await openDemo(page)

  await page.getByRole('button', { name: 'Add item' }).click()
  await page.getByRole('menuitem', { name: /^Item/ }).click()

  const dialog = page.getByRole('dialog', { name: 'Add item' })
  await expect(dialog).toBeVisible({ timeout: 10_000 })

  await page.setViewportSize(KEYBOARD_VIEWPORT)
  await expect(dialog).toBeVisible()
  await expectKeyboardSafeDialog(page)

  const metrics = await readDialogMetrics(page)
  expect(metrics.panel).not.toBeNull()
  expect(metrics.panel!.top).toBeGreaterThanOrEqual(-1)
  expect(metrics.panel!.bottom).toBeLessThanOrEqual(KEYBOARD_VIEWPORT.height + 1)
  expect(metrics.overlay!.scrollHeight).toBeLessThanOrEqual(metrics.overlay!.clientHeight + 1)
  expect(metrics.body!.overflowY).toBe('auto')
  expect(metrics.body!.clientHeight).toBeGreaterThan(0)
})
