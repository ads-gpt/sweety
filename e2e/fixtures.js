import fs from 'node:fs';
import path from 'node:path';
import { test as base, expect } from '@playwright/test';
import { OUTBOX_DIR, API_URL } from './playwright.config.js';

export { expect, API_URL };

export const DEMO = {
  patient: { email: 'demo@sweety.app', password: 'Password123!', name: 'Demo Patient' },
  doctor: { email: 'doctor@sweety.app', password: 'Password123!', name: 'Dr. Asha Rao' },
  pendingDoctor: { email: 'newdoc@sweety.app', password: 'Password123!' },
};

let counter = 0;
export const uniqueEmail = (tag = 'user') => `${tag}.${Date.now().toString(36)}${counter++}@example.com`;

/** Today's calendar date (YYYY-MM-DD) in a timezone, matching how the app decides "today". */
export const todayIn = (tz = 'Asia/Kolkata', offsetDays = 0) => {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
};

/** Read the emails the API wrote to the file outbox (no email is ever really sent in e2e). */
export function readOutbox() {
  const file = path.join(OUTBOX_DIR, 'outbox.jsonl');
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

export const emailsTo = (to) => readOutbox().filter((m) => m.to === to);

/** Wait for an email to `to` whose subject matches, and return the first link found in its text. */
export async function emailedLink(to, subjectPattern) {
  let found;
  await expect.poll(() => {
    found = emailsTo(to).filter((m) => subjectPattern.test(m.subject)).at(-1);
    return Boolean(found);
  }, { message: `waiting for an email to ${to} matching ${subjectPattern}`, timeout: 10_000 }).toBe(true);
  return /https?:\/\/\S+/.exec(found.text)[0];
}

/**
 * Create an account through the API (fast). Used with `page.request`, the session cookie lands in the
 * browser context (cookies are scoped by host, not port), so the next page.goto() is already signed in.
 * Used with the plain `request` fixture it creates an account without signing the browser in.
 */
export async function apiSignup(request, { role = 'patient', name = 'E2E Tester', password = 'e2e-password-1', timezone = 'Asia/Kolkata', email, ...extra } = {}) {
  email ||= uniqueEmail(role);
  const res = await request.post(`${API_URL}/api/auth/signup`, {
    data: { name, email, password, role, timezone, ...(role === 'doctor' ? { licenseNumber: 'E2E-REG-1' } : {}), ...extra },
  });
  expect(res.ok(), `signup failed: ${await res.text()}`).toBeTruthy();
  const body = await res.json();
  return { email, password, name, id: body.user.id, token: body.token };
}

/** Add a reading directly through the API as the signed-in browser user. */
export async function apiReading(page, data) {
  const res = await page.request.post(`${API_URL}/api/readings`, { data: { notes: null, tags: [], ...data } });
  expect(res.ok(), `adding a reading failed: ${await res.text()}`).toBeTruthy();
  return (await res.json()).reading;
}

export const test = base.extend({
  /** A signed-in, fresh patient (the browser already has the session). */
  patient: async ({ page }, use) => use(await apiSignup(page.request, { name: 'Pat Ient' })),
  /** Make more accounts: `const doc = await makeUser({ role: 'doctor' })` (signs the browser in as them). */
  makeUser: async ({ page }, use) => use((opts) => apiSignup(page.request, opts)),
  /** Make an account WITHOUT signing the browser in. */
  newAccount: async ({ request }, use) => use((opts) => apiSignup(request, opts)),
});

export async function signIn(page, { email, password }) {
  await page.goto('/');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).last().click();
}

/** Add a reading through the UI dialog. */
export async function addReadingViaUi(page, { slot, value, tags = [], notes }) {
  await page.getByRole('button', { name: 'Add reading' }).first().click();
  await page.getByRole('combobox', { name: /time slot/i }).click();
  await page.getByRole('option', { name: new RegExp(slot, 'i') }).click();
  await page.getByLabel(/Glucose value/).fill(String(value));
  for (const tag of tags) await page.getByRole('group', { name: 'Reading tags' }).getByRole('button', { name: tag }).click();
  if (notes) await page.getByLabel('Notes (optional)').fill(notes);
  await page.getByRole('button', { name: 'Save reading' }).click();
}
