import { test, expect, DEMO, signIn, apiReading, todayIn } from '../fixtures.js';

test.describe('reports with known numbers', () => {
  test('daily report shows highest, lowest, average (1 decimal) and count with each slot', async ({ page, patient }) => {
    void patient;
    const today = todayIn('Asia/Kolkata');
    await apiReading(page, { date: today, slot: 'morning', value: 100 });
    await apiReading(page, { date: today, slot: 'after_breakfast', value: 141 });
    await apiReading(page, { date: today, slot: 'after_dinner', value: 120 });
    await page.goto('/reports');

    const band = page.locator('dl');
    await expect(band.locator('div', { hasText: 'Highest' }).first()).toContainText('141');
    await expect(band.locator('div', { hasText: 'Lowest' }).first()).toContainText('100');
    await expect(band.locator('div', { hasText: 'Average' }).first()).toContainText('120.3');
    await expect(band.locator('div', { hasText: 'Readings' }).first()).toContainText('3');

    const list = page.getByRole('heading', { name: 'Readings' }).locator('..').getByRole('listitem');
    await expect(list).toHaveCount(3);
    await expect(list.nth(0)).toContainText('Morning (fasting)');
    await expect(list.nth(1)).toContainText('After breakfast');
    await expect(list.nth(2)).toContainText('After dinner');
  });

  test('time in range follows the personal fasting and after-meal targets', async ({ page, patient }) => {
    void patient;
    const today = todayIn('Asia/Kolkata');
    await apiReading(page, { date: today, slot: 'morning', value: 120 });         // fasting 70-130: in range
    await apiReading(page, { date: today, slot: 'after_breakfast', value: 150 }); // after meals 70-180: in range
    await apiReading(page, { date: today, slot: 'after_lunch', value: 200 });     // high
    await apiReading(page, { date: today, slot: 'after_dinner', value: 65 });     // low
    await page.goto('/reports');
    const tir = page.getByRole('region', { name: 'Time in range' });
    await expect(tir).toContainText('50');
    await expect(tir).toContainText('Below range 25%');
    await expect(tir).toContainText('Above range 25%');
    await expect(tir).toContainText('Targets: fasting 70–130, after meals 70–180 mg/dl.');
    await expect(tir).toContainText('Needs at least 10 readings in the period (4 so far).');
  });

  test('empty periods show a friendly empty state', async ({ page, patient }) => {
    void patient;
    await page.goto('/reports');
    await expect(page.getByText('Nothing to report yet')).toBeVisible();
    await page.getByRole('tab', { name: 'Previous month' }).click();
    await expect(page.getByText('Nothing to report yet')).toBeVisible();
  });
});

test.describe('the three report ranges (demo data)', () => {
  test('daily / month to date / previous month cover the right dates', async ({ page }) => {
    await signIn(page, DEMO.patient);
    await page.getByRole('link', { name: 'Reports' }).first().click();

    // Same formatting the app uses (browser ICU), so month abbreviations match.
    const labels = await page.evaluate((today) => {
      const [y, m, d] = today.split('-').map(Number);
      const day = { day: 'numeric', month: 'short' };
      const full = { day: 'numeric', month: 'short', year: 'numeric' };
      const f = (dt, o) => dt.toLocaleDateString('en-GB', o);
      const prevFirst = new Date(y, m - 2, 1);
      const prevLast = new Date(y, m - 1, 0);
      return {
        daily: f(new Date(y, m - 1, d), full),
        mtd: `${f(new Date(y, m - 1, 1), day)} – ${f(new Date(y, m - 1, d), full)}`,
        prev: `${f(prevFirst, day)} – ${f(prevLast, full)}`,
      };
    }, todayIn('Asia/Kolkata'));

    await expect(page.locator('p:visible', { hasText: labels.daily }).first()).toBeVisible();
    await page.getByRole('tab', { name: 'Month to date' }).click();
    await expect(page.locator('p:visible', { hasText: labels.mtd }).first()).toBeVisible();
    await page.getByRole('tab', { name: 'Previous month' }).click();
    await expect(page.locator('p:visible', { hasText: labels.prev }).first()).toBeVisible();

    for (const heading of ['Time in range', 'Estimated HbA1c']) await expect(page.getByText(heading).first()).toBeVisible();
    await expect(page.getByText('Daily average')).toBeVisible(); // the chart
    await expect(page.locator('svg.recharts-surface').first()).toBeVisible();

    await page.getByLabel('Selected date').fill('2020-05-10');
    await expect(page.getByText('Nothing to report yet')).toBeVisible();
  });

  test('prints cleanly: app chrome hidden, report header shown, PDF renders', async ({ page }) => {
    await signIn(page, DEMO.patient);
    await page.getByRole('link', { name: 'Reports' }).first().click();
    await page.getByRole('tab', { name: 'Month to date' }).click();
    await expect(page.getByText('Time in range').first()).toBeVisible();

    await page.emulateMedia({ media: 'print' });
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden();
    await expect(page.getByText('Sweety glucose report')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Print / PDF' })).toBeHidden();
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    expect(pdf.length).toBeGreaterThan(20_000);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
