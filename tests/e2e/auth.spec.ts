import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const configuredOrigin = 'http://127.0.0.1:4174'

async function mockSupabase(page: Page) {
  await page.route('https://test.supabase.co/**', async (route) => {
    const url = new URL(route.request().url())
    const headers = { 'access-control-allow-origin': '*', 'content-type': 'application/json' }

    if (url.pathname.endsWith('/signup')) {
      await route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify({
          user: {
            id: 'test-user',
            aud: 'authenticated',
            role: 'authenticated',
            email: 'reader@example.com',
            email_confirmed_at: null,
            phone: '',
            app_metadata: { provider: 'email', providers: ['email'] },
            user_metadata: {},
            identities: [],
            created_at: new Date(0).toISOString(),
            updated_at: new Date(0).toISOString(),
          },
          session: null,
        }),
      })
      return
    }

    if (url.pathname.endsWith('/resend') || url.pathname.endsWith('/recover')) {
      await route.fulfill({ status: 200, headers, body: '{}' })
      return
    }

    if (url.pathname.endsWith('/token') && url.searchParams.get('grant_type') === 'password') {
      await route.fulfill({
        status: 400,
        headers,
        body: JSON.stringify({ message: 'Invalid login credentials' }),
      })
      return
    }

    await route.fulfill({ status: 200, headers, body: '{}' })
  })
}

async function openAdmission(page: Page) {
  await mockSupabase(page)
  await page.goto(configuredOrigin)
  await page.getByRole('button', { name: 'Sign in' }).focus()
  await page.getByRole('button', { name: 'Sign in' }).press('Enter')
  // The lazy VaultApp chunk is fetched from a cold dev server; under full parallel
  // load the first load can take well over 15s, so allow more room before failing.
  await expect(page.getByRole('heading', { name: 'Sign in.' })).toBeVisible({ timeout: 30_000 })
}

test('Frame 10 keeps one native form with keyboard and password controls', async ({ page }) => {
  await openAdmission(page)

  await expect(page.locator('form')).toHaveCount(1)
  const email = page.getByLabel('Email')
  const password = page.getByLabel('Password', { exact: true })
  await email.fill('not-an-email')
  await password.fill('secret12')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(email).toHaveJSProperty('validity.valid', false)

  await expect(password).toHaveAttribute('type', 'password')
  await page.getByRole('button', { name: 'Show password' }).click()
  await expect(password).toHaveAttribute('type', 'text')

  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
})

test('Frame 11 remains mounted while a verification email is resent', async ({ page }) => {
  await openAdmission(page)
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await page.getByLabel('Email').fill('reader@example.com')
  await page.getByLabel('Password', { exact: true }).fill('secret12')
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page.getByRole('heading', { name: 'Check your email.' })).toBeVisible()
  await expect(page.locator('form')).toHaveCount(0)
  await page.getByRole('button', { name: 'Send again' }).click()
  await expect(page.getByRole('heading', { name: 'Check your email.' })).toBeVisible()
  await expect(page.getByText('reader@example.com')).toBeVisible()
  await expect(page.getByRole('button', { name: /Send again in 30s|Sending/ })).toBeDisabled()
})

test('Frame 12 issues a privacy-neutral recovery receipt', async ({ page }) => {
  await openAdmission(page)
  await page.getByRole('button', { name: 'Forgot password?' }).click()
  await expect(page.getByRole('heading', { name: 'Reset your password.' })).toBeVisible()
  await expect(page.locator('form')).toHaveCount(1)

  await page.getByLabel('Email').fill('reader@example.com')
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await expect(page.getByRole('heading', { name: 'Check your email.' })).toBeVisible()
  await expect(page.getByText(/If an account exists for this email/)).toBeVisible()
})

test('invalid verification callbacks open Frame 11 directly', async ({ page }) => {
  await mockSupabase(page)
  await page.goto(`${configuredOrigin}/#error=access_denied&error_description=Link%20expired`)

  await expect(page.getByRole('heading', { name: 'This verification link has expired or is invalid.' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('alert')).toContainText('Link expired')
  await page.getByRole('button', { name: 'Send another link' }).click()
  await expect(page.getByRole('heading', { name: 'Resend verification email.' })).toBeVisible()
  await expect(page.locator('form')).toHaveCount(1)
})

test('Frame 13 returns to the catalogue without horizontal overflow', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Sign-in is unavailable.' })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Return home' }).click()
  await expect(page.getByRole('heading', { name: 'Everything you meant to keep.' })).toBeVisible()

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

test('sign-in errors use clear, actionable language', async ({ page }) => {
  await openAdmission(page)
  await page.getByLabel('Email').fill('reader@example.com')
  await page.getByLabel('Password', { exact: true }).fill('wrong-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Incorrect email or password.')
})

test('@visual Frames 10 and 11 remain stable', async ({ page }) => {
  await openAdmission(page)
  await page.addStyleTag({
    content: '.film-grain { display: none !important; } * { caret-color: transparent !important; }',
  })
  await expect(page.locator('.accession-auth-frame')).toHaveScreenshot('auth-admission.png')

  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await page.getByLabel('Email').fill('reader@example.com')
  await page.getByLabel('Password', { exact: true }).fill('secret12')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.locator('.accession-auth-frame')).toHaveScreenshot('auth-verification.png')
})
