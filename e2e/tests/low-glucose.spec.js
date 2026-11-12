import { test, expect, addReadingViaUi, apiReading, todayIn } from '../fixtures.js';

test.describe('low glucose alert', () => {
  test.beforeEach(async ({ page, patient }) => { void patient; await page.goto('/'); });

  test('a very low reading shows an urgent treatment plan', async ({ page }) => {
    await addReadingViaUi(page, { slot: 'After lunch', value: 48 });
    const alert = page.getByRole('alertdialog');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('Very low glucose');
    await expect(alert).toContainText('48 mg/dl is very low.');
    await expect(alert).toContainText('Act now');
    await expect(alert.getByRole('listitem')).toHaveCount(3);
    await expect(alert).toContainText('15 g of fast-acting carbohydrate');
    await expect(alert).toContainText('emergency services');

    // the reading itself was still saved, and is labelled Low on the dashboard
    await alert.getByRole('button', { name: 'OK, got it' }).click();
    await expect(alert).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Edit After lunch reading' })).toContainText('48');
    await expect(page.getByRole('button', { name: 'Edit After lunch reading' })).toContainText('Low');
  });

  test('a reading just below target shows a calmer prompt', async ({ page }) => {
    await addReadingViaUi(page, { slot: 'After dinner', value: 66 });
    const alert = page.getByRole('alertdialog');
    await expect(alert).toContainText('Low glucose');
    await expect(alert).toContainText('66 mg/dl is below your target of 70 mg/dl.');
    await expect(alert).toContainText('What to do');
    await expect(alert.getByRole('listitem')).toHaveCount(2);
    await expect(alert).not.toContainText('Act now');
  });

  test('a normal or high reading shows no alert', async ({ page }) => {
    await addReadingViaUi(page, { slot: 'Morning', value: 110 });
    await expect(page.getByText('Reading saved')).toBeVisible();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await addReadingViaUi(page, { slot: 'After lunch', value: 260 });
    await expect(page.getByText('Reading saved').first()).toBeVisible();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
  });

  test('can start a recheck timer from the alert', async ({ page }) => {
    await addReadingViaUi(page, { slot: 'After lunch', value: 60 });
    await page.getByRole('button', { name: 'Remind me to recheck' }).click();
    await expect(page.getByRole('button', { name: /Timer running/ })).toBeDisabled();
    await expect(page.getByText('Recheck timer set for 15 minutes').first()).toBeVisible();
  });

  test('uses the person\'s own target: a stricter range turns 85 into a low', async ({ page }) => {
    await page.goto('/settings');
    await page.locator('#t-pl').fill('90');
    await page.getByRole('button', { name: 'Save targets' }).click();
    await expect(page.getByText('Target ranges saved').first()).toBeVisible();
    await page.goto('/');
    await addReadingViaUi(page, { slot: 'After lunch', value: 85 });
    await expect(page.getByRole('alertdialog')).toContainText('below your target of 90 mg/dl');
  });

  test('editing a reading down to a low value also alerts', async ({ page }) => {
    await apiReading(page, { date: todayIn('Asia/Kolkata'), slot: 'morning', value: 120 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Edit Morning (fasting) reading' }).click();
    await page.getByLabel(/Glucose value/).fill('52');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('alertdialog')).toContainText('Very low glucose');
  });
});
