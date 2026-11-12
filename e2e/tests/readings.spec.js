import fs from 'node:fs';
import { test, expect, API_URL, apiReading, addReadingViaUi, todayIn } from '../fixtures.js';

const SLOTS = ['morning', 'after_breakfast', 'after_lunch', 'after_dinner'];

test.describe('adding readings: validation messages', () => {
  test.beforeEach(async ({ page, patient }) => { void patient; await page.goto('/'); });

  test('requires a value and a slot', async ({ page }) => {
    await page.getByRole('button', { name: 'Add reading' }).first().click();
    await page.getByRole('button', { name: 'Save reading' }).click();
    await expect(page.getByText('Please enter a glucose value.')).toBeVisible();
    await expect(page.getByText('Please choose a time slot.')).toBeVisible();
  });

  for (const [value, message] of [
    ['39', 'Value must be between 40 and 600 mg/dl.'],
    ['601', 'Value must be between 40 and 600 mg/dl.'],
    ['100.5', 'Value must be a whole number between 40 and 600 mg/dl.'],
  ]) {
    test(`rejects ${value}`, async ({ page }) => {
      await addReadingViaUi(page, { slot: 'After lunch', value });
      await expect(page.getByText(message)).toBeVisible();
    });
  }

  test('accepts the boundary values 40 and 600', async ({ page }) => {
    await addReadingViaUi(page, { slot: 'Morning', value: 600 });
    await expect(page.getByText('Reading saved')).toBeVisible();
    await expect(page.getByRole('alertdialog')).toHaveCount(0); // 600 is high, not low
  });

  test('rejects a date in the future', async ({ page }) => {
    await page.getByRole('button', { name: 'Add reading' }).first().click();
    await page.getByLabel('Date').fill(todayIn('Asia/Kolkata', 2));
    await page.getByRole('combobox', { name: /time slot/i }).click();
    await page.getByRole('option', { name: /After lunch/ }).click();
    await page.getByLabel(/Glucose value/).fill('120');
    await page.getByRole('button', { name: 'Save reading' }).click();
    await expect(page.getByText('Date cannot be in the future.')).toBeVisible();
  });

  test('only one reading per slot per day (checked in the form and again by the server)', async ({ page }) => {
    await addReadingViaUi(page, { slot: 'After lunch', value: 140 });
    await expect(page.getByText('Reading saved')).toBeVisible();

    await addReadingViaUi(page, { slot: 'After lunch', value: 150 });
    await expect(page.getByText('You already have an After lunch reading for this date.')).toBeVisible();

    // The server enforces it too, for any client that skips the form checks.
    const res = await page.request.post(`${API_URL}/api/readings`, { data: { date: todayIn('Asia/Kolkata'), slot: 'after_lunch', value: 150 } });
    expect(res.status()).toBe(409);
    expect((await res.json()).error.message).toBe('You already have an After lunch reading for this date.');
  });

  test('at most 4 readings per day', async ({ page }) => {
    for (const [i, slot] of SLOTS.entries()) await apiReading(page, { date: todayIn('Asia/Kolkata'), slot, value: 100 + i });
    await page.reload();
    await page.getByRole('button', { name: 'Add reading' }).first().click();
    await page.getByRole('combobox', { name: /time slot/i }).click();
    await page.getByRole('option', { name: /Morning/ }).click();
    await page.getByLabel(/Glucose value/).fill('110');
    await page.getByRole('button', { name: 'Save reading' }).click();
    await expect(page.getByText('You can add only 4 readings per day.')).toBeVisible();
  });
});

test.describe('managing readings', () => {
  test('add with tags and a note, edit, then delete', async ({ page, patient }) => {
    void patient;
    await page.goto('/readings');
    await addReadingViaUi(page, { slot: 'After breakfast', value: 150, tags: ['Exercise', 'Travel'], notes: 'Airport breakfast' });
    await expect(page.getByText('Reading saved')).toBeVisible();

    const row = page.getByRole('list', { name: 'Readings' }).getByRole('listitem').first();
    await expect(row).toContainText('After breakfast');
    await expect(row).toContainText('Airport breakfast');
    await expect(row).toContainText('Exercise');
    await expect(row).toContainText('150');

    await row.getByRole('button', { name: /^Edit/ }).click();
    await page.getByLabel(/Glucose value/).fill('165');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Reading updated')).toBeVisible();
    await expect(row).toContainText('165');

    await row.getByRole('button', { name: /^Delete/ }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText('Reading deleted')).toBeVisible();
    await expect(page.getByText('No readings yet')).toBeVisible();
  });

  test('paginates, and filters by tag, notes search and date', async ({ page, patient }) => {
    void patient;
    // 12 readings on 12 different days; two are tagged, one has a distinctive note
    for (let d = 0; d < 12; d++) {
      await apiReading(page, {
        date: todayIn('Asia/Kolkata', -d), slot: 'after_lunch', value: 120 + d,
        tags: d === 3 || d === 7 ? ['big_meal'] : [], notes: d === 5 ? 'Wedding lunch' : null,
      });
    }
    await page.goto('/readings');
    await expect(page.getByText('Page 1 of 2 · 12 readings')).toBeVisible();
    await expect(page.getByRole('list', { name: 'Readings' }).getByRole('listitem')).toHaveCount(10);
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Page 2 of 2 · 12 readings')).toBeVisible();
    await expect(page.getByRole('list', { name: 'Readings' }).getByRole('listitem')).toHaveCount(2);

    await page.getByLabel('Filter by tag').selectOption('big_meal');
    await expect(page.getByText('Page 1 of 1 · 2 readings')).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();

    await page.getByPlaceholder('Search notes').fill('wedding');
    await expect(page.getByText('Page 1 of 1 · 1 readings')).toBeVisible();
    await expect(page.getByText('Wedding lunch')).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();

    await page.getByLabel('Filter by date').fill(todayIn('Asia/Kolkata', -2));
    await expect(page.getByText('Page 1 of 1 · 1 readings')).toBeVisible();
    await page.getByLabel('Filter by date').fill('2001-01-01');
    await expect(page.getByText('No readings match')).toBeVisible();
  });

  test('exports the (filtered) readings as CSV', async ({ page, patient }) => {
    void patient;
    await apiReading(page, { date: todayIn('Asia/Kolkata'), slot: 'morning', value: 99, tags: ['exercise'], notes: 'Before a run' });
    await apiReading(page, { date: todayIn('Asia/Kolkata'), slot: 'after_lunch', value: 210, notes: 'Pizza, large' });
    await page.goto('/readings');

    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export CSV' }).click()]);
    expect(download.suggestedFilename()).toBe('sweety-readings.csv');
    const lines = fs.readFileSync(await download.path(), 'utf8').trim().split('\n');
    expect(lines[0]).toBe('date,slot,value_mg_dl,status,tags,notes');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain(',Morning (fasting),99,ok,exercise,Before a run');
    expect(lines[2]).toContain('"Pizza, large"');
    expect(lines[2]).toContain(',high,');
  });

  test("never shows another user's readings", async ({ page, patient, newAccount }) => {
    void patient;
    const other = await newAccount({ name: 'Someone Else' });
    const mine = await apiReading(page, { date: todayIn('Asia/Kolkata'), slot: 'morning', value: 111 });
    await page.goto('/readings');
    await expect(page.getByRole('list', { name: 'Readings' })).toContainText('111');
    expect(other.email).not.toBe(patient.email);
    // a stranger cannot read or change it by id (404, not 403, so ids cannot be probed)
    const res = await page.request.get(`${API_URL}/api/readings/${mine.id}`, { headers: { Authorization: `Bearer ${other.token}` } });
    expect(res.status()).toBe(404);
  });
});
