import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'test-results',
  timeout: 60_000,
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  expect: {
    timeout: 15_000,
    toHaveScreenshot: {
      animations: 'disabled',
      maxDiffPixelRatio: 0.015,
    },
  },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop-chrome',
      use: {
        browserName: 'chromium',
        channel: process.env.CI ? undefined : 'chrome',
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 7'],
        browserName: 'chromium',
        channel: process.env.CI ? undefined : 'chrome',
      },
    },
    ...(!process.env.CI
      ? [{
          name: 'desktop-edge',
          grepInvert: /@visual/,
          use: {
            browserName: 'chromium' as const,
            channel: 'msedge',
            viewport: { width: 1440, height: 900 },
          },
        }]
      : []),
    ...(process.env.CI
      ? [
          {
            name: 'desktop-firefox',
            grepInvert: /@visual/,
            use: { browserName: 'firefox' as const, viewport: { width: 1440, height: 900 } },
          },
          {
            name: 'desktop-webkit',
            grepInvert: /@visual/,
            use: { browserName: 'webkit' as const, viewport: { width: 1440, height: 900 } },
          },
        ]
      : []),
  ],
  webServer: [
    {
      command: 'npm run dev -- --mode test-unconfigured --host 127.0.0.1 --port 4173',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev -- --mode test --host 127.0.0.1 --port 4174',
      url: 'http://127.0.0.1:4174',
      reuseExistingServer: !process.env.CI,
    },
  ],
})