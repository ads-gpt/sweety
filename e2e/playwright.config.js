import path from 'node:path';
import { defineConfig } from '@playwright/test';

const CI = !!process.env.CI;

// Everything the suite starts is isolated from a developer's own dev servers and data:
//   API  :4100  (own port; CORS/CSRF origin is the preview URL)
//   Web  :4173  (the production build served by `vite preview`, with the real security headers)
//   DB   sweety_e2e (created and seeded by run-api.js)
export const API_URL = 'http://localhost:4100';
export const WEB_URL = 'http://localhost:4173';
export const OUTBOX_DIR = path.join(import.meta.dirname, '.outbox');
export const DATABASE_URL = process.env.E2E_DATABASE_URL || 'postgres://sweety:sweety@localhost:5432/sweety_e2e';

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  workers: 1, // tests share one database; each creates its own users
  retries: CI ? 1 : 0,
  forbidOnly: CI,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: WEB_URL,
    locale: 'en-GB',
    timezoneId: 'Asia/Kolkata',
    // Locally you can use an installed Chrome: PW_CHANNEL=chrome npm test. CI installs Playwright's Chromium.
    channel: process.env.PW_CHANNEL || undefined,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'node run-api.js',
      url: `${API_URL}/api/health`,
      timeout: 60_000,
      reuseExistingServer: false,
      env: {
        NODE_ENV: 'development', PORT: '4100', DATABASE_URL, CLIENT_ORIGIN: WEB_URL, JWT_SECRET: 'e2e-secret',
        // Emails are written to a file the tests read; nothing is ever sent (or printed).
        MAIL_OUTBOX_DIR: OUTBOX_DIR, MAILGUN_API_KEY: '', LOG_LEVEL: 'warn', AUTH_RATE_LIMIT: '100000',
        VAPID_PUBLIC_KEY: '', VAPID_PRIVATE_KEY: '', REDIS_URL: '',
      },
    },
    {
      command: 'npm --prefix ../client run build && npm --prefix ../client run preview -- --strictPort',
      url: WEB_URL,
      timeout: 120_000,
      reuseExistingServer: false,
      env: { VITE_API_TARGET: API_URL },
    },
  ],
});
