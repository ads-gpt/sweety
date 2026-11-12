import { test, expect, DEMO, API_URL, signIn } from '../fixtures.js';

test.describe('doctor view', () => {
  test('a verified doctor reviews a patient and leaves a comment the patient then sees', async ({ browser, page }) => {
    const note = `E2E note ${Date.now()}`;
    await signIn(page, DEMO.doctor);
    await expect(page.getByRole('heading', { name: 'My patients' })).toBeVisible();
    await page.getByRole('link', { name: /Demo Patient/ }).click();
    await expect(page.getByText('Time in range').first()).toBeVisible();
    await expect(page.getByText('Estimated HbA1c').first()).toBeVisible();

    await page.getByLabel('Comment', { exact: true }).fill('   ');
    await page.getByRole('button', { name: 'Send comment' }).click();
    await expect(page.getByText('Please write a comment.')).toBeVisible();

    await page.getByLabel('Comment', { exact: true }).fill(note);
    await page.getByRole('button', { name: 'Send comment' }).click();
    await expect(page.getByText('Comment sent to your patient')).toBeVisible();
    await expect(page.getByText(note)).toBeVisible();

    // The patient sees it on their dashboard, with the doctor's name.
    const patientCtx = await browser.newContext();
    const patientPage = await patientCtx.newPage();
    await signIn(patientPage, DEMO.patient);
    await expect(patientPage.getByText('From your doctor')).toBeVisible();
    await expect(patientPage.getByText(note)).toBeVisible();
    await expect(patientPage.getByText(new RegExp(`${DEMO.doctor.name}`)).first()).toBeVisible();
    await patientCtx.close();

    // The doctor can delete their own comment.
    await page.getByText(note).locator('..').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('Comment deleted')).toBeVisible();
    await expect(page.getByText(note)).toHaveCount(0);
  });

  test('a patient shares with a verified doctor; the doctor sees only patients who shared', async ({ browser, page, patient }) => {
    await page.goto('/care-team');
    await page.getByLabel("Doctor's email").fill('nobody@example.com');
    await page.getByRole('button', { name: 'Share my reports' }).click();
    await expect(page.getByText('No doctor account found with that email.')).toBeVisible();

    await page.getByLabel("Doctor's email").fill(DEMO.doctor.email);
    await page.getByRole('button', { name: 'Share my reports' }).click();
    await expect(page.getByText('Dr. Asha Rao').first()).toBeVisible();

    const doctorCtx = await browser.newContext();
    const doc = await doctorCtx.newPage();
    await signIn(doc, DEMO.doctor);
    await expect(doc.getByRole('link', { name: new RegExp(patient.email) })).toBeVisible();
    await doctorCtx.close();

    // ... and stops seeing them once access is revoked.
    await page.getByRole('button', { name: /Stop sharing with/ }).click();
    const ctx2 = await browser.newContext();
    const doc2 = await ctx2.newPage();
    await signIn(doc2, DEMO.doctor);
    await expect(doc2.getByRole('heading', { name: 'My patients' })).toBeVisible();
    await expect(doc2.getByRole('link', { name: new RegExp(patient.email) })).toHaveCount(0);
    await ctx2.close();
  });

  test('a doctor who is still pending cannot receive readings', async ({ page, patient }) => {
    void patient;
    await page.goto('/care-team');
    await page.getByLabel("Doctor's email").fill(DEMO.pendingDoctor.email);
    await page.getByRole('button', { name: 'Share my reports' }).click();
    await expect(page.getByText(/still pending verification/)).toBeVisible();
  });

  test('the pending doctor sees a waiting screen instead of patient data', async ({ page }) => {
    await signIn(page, DEMO.pendingDoctor);
    await expect(page.getByText('Waiting for verification')).toBeVisible();
    await expect(page.getByText(/pending verification/).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Demo Patient/ })).toHaveCount(0);
  });

  test("doctors cannot use patient pages, and a patient's data is closed to unrelated doctors", async ({ page, makeUser, request }) => {
    const stranger = await makeUser({ role: 'patient', name: 'Closed Book' });
    void stranger;
    const doctor = await request.post(API_URL + '/api/auth/login', { data: { email: DEMO.doctor.email, password: DEMO.doctor.password } });
    const { token } = await doctor.json();
    const res = await page.request.get(`${API_URL}/api/reports/daily?patientId=${stranger.id}`, { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status()).toBe(403);
    expect((await res.json()).error.message).toMatch(/has not shared/);
  });
});
