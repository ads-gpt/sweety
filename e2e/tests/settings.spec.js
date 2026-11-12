import fs from 'node:fs';
import { test, expect, API_URL, apiReading, todayIn, signIn } from '../fixtures.js';

test.describe('settings', () => {
  test('timezone decides what "today" is', async ({ page, patient }) => {
    void patient;
    await page.goto('/settings');
    await page.getByLabel('Timezone').selectOption('Pacific/Kiritimati'); // UTC+14
    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect(page.getByText('Profile saved').first()).toBeVisible();

    await page.goto('/');
    const expected = await page.evaluate(() => new Intl.DateTimeFormat('en-GB', { timeZone: 'Pacific/Kiritimati', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()).replace(',', '').toUpperCase());
    await expect(page.locator('p.eyebrow').first()).toHaveText(new RegExp(expected.replace(/\s+/g, '\\s*,?\\s*'), 'i'));
  });

  test('target ranges are validated, saved and change the labels', async ({ page, patient }) => {
    void patient;
    await apiReading(page, { date: todayIn('Asia/Kolkata'), slot: 'morning', value: 150 });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Edit Morning (fasting) reading' })).toContainText('High'); // default fasting 70-130

    await page.goto('/settings');
    await page.locator('#t-fl').fill('140');
    await page.getByRole('button', { name: 'Save targets' }).click();
    await expect(page.getByText('Fasting low must be below fasting high.')).toBeVisible();
    await page.locator('#t-fl').fill('7');
    await page.getByRole('button', { name: 'Save targets' }).click();
    await expect(page.getByText(/whole numbers between 40 and 600/)).toBeVisible();

    await page.locator('#t-fl').fill('70');
    await page.locator('#t-fh').fill('160');
    await page.getByRole('button', { name: 'Save targets' }).click();
    await expect(page.getByText('Target ranges saved').first()).toBeVisible();

    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Edit Morning (fasting) reading' })).toContainText('In range');
  });

  test('reminder preferences persist across reloads', async ({ page, patient }) => {
    void patient;
    await page.goto('/settings');
    await page.getByRole('switch', { name: /By email/ }).evaluate((el) => el.click());
    await expect(page.getByRole('switch', { name: /By email/ })).not.toBeChecked();
    await page.locator('#reminder-time').fill('07:30');
    await page.locator('#reminder-time').blur();
    await expect(page.getByText('Reminder time saved').first()).toBeVisible();

    await page.reload();
    await expect(page.getByRole('switch', { name: /By email/ })).not.toBeChecked();
    await expect(page.locator('#reminder-time')).toHaveValue('07:30');
    await expect(page.getByRole('switch', { name: /Daily reminder/ })).toBeChecked();
  });

  test('changing the password checks the current one and keeps you signed in', async ({ page, patient }) => {
    await page.goto('/settings');
    await page.getByLabel('Current password').fill('not-my-password');
    await page.getByLabel('New password').fill('brand-new-pass-1');
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByText('Your current password is incorrect.')).toBeVisible();

    await page.getByLabel('Current password').fill(patient.password);
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByText('Password changed').first()).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible(); // still signed in here
  });
});

test.describe('your data', () => {
  test('downloads everything as JSON, without secrets', async ({ page, patient }) => {
    await apiReading(page, { date: todayIn('Asia/Kolkata'), slot: 'morning', value: 123, tags: ['exercise'], notes: 'export me' });
    await page.goto('/settings');
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download my data' }).click()]);
    expect(download.suggestedFilename()).toBe('sweety-data.json');
    const raw = fs.readFileSync(await download.path(), 'utf8');
    const data = JSON.parse(raw);
    expect(data.profile.email).toBe(patient.email);
    expect(data.readings).toHaveLength(1);
    expect(data.readings[0]).toMatchObject({ value: 123, slot: 'morning', notes: 'export me', tags: ['exercise'] });
    expect(raw).not.toMatch(/password|hash|token/i);
  });

  test('deleting the account needs the password, then removes everything', async ({ page, patient, request }) => {
    await apiReading(page, { date: todayIn('Asia/Kolkata'), slot: 'morning', value: 123 });
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Delete account…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Delete your account?' });

    await dialog.getByRole('button', { name: 'Delete everything' }).click();
    await expect(dialog.getByText('Please enter your password to confirm.')).toBeVisible();
    await dialog.getByLabel('Enter your password to confirm').fill('definitely-wrong');
    await dialog.getByRole('button', { name: 'Delete everything' }).click();
    await expect(dialog.getByText('Your password is incorrect.')).toBeVisible();

    await dialog.getByLabel('Enter your password to confirm').fill(patient.password);
    await dialog.getByRole('button', { name: 'Delete everything' }).click();
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();

    const login = await request.post(`${API_URL}/api/auth/login`, { data: { email: patient.email, password: patient.password } });
    expect(login.status()).toBe(401);
    await signIn(page, patient);
    await expect(page.getByText('Incorrect email or password.')).toBeVisible();
  });

  test('"sign out of all devices" ends every session', async ({ browser, page, patient }) => {
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await signIn(otherPage, patient);
    await expect(otherPage.getByText('This month so far')).toBeVisible();

    await page.goto('/settings');
    await page.getByRole('button', { name: 'Sign out of all devices' }).click();
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();

    await otherPage.reload();
    await expect(otherPage.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await other.close();
  });
});
