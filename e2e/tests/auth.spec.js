import { test, expect, emailedLink, emailsTo, uniqueEmail, signIn } from '../fixtures.js';

test.describe('sign up and email verification', () => {
  test('a new patient signs up, sees the verify banner, and verifies from the emailed link', async ({ page }) => {
    const email = uniqueEmail('signup');
    await page.goto('/');
    await page.getByRole('tab', { name: 'Sign up' }).click();
    await page.getByLabel('Full name').fill('Eve Tester');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('first-pass-1');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByText('This month so far')).toBeVisible();
    await expect(page.getByText(/Please verify your email address/)).toBeVisible();

    const link = await emailedLink(email, /Verify your Sweety email/);
    const other = await page.context().newPage();
    await other.goto(link);
    await expect(other.getByRole('heading', { name: 'Email verified' })).toBeVisible();

    await page.reload();
    await expect(page.getByText('This month so far')).toBeVisible();
    await expect(page.getByText(/Please verify your email address/)).toHaveCount(0);
  });

  test('shows clear messages for bad sign-up input and a taken email', async ({ page, newAccount }) => {
    const taken = await newAccount({ name: 'Taken' });
    await page.goto('/');
    await page.getByRole('tab', { name: 'Sign up' }).click();
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Please enter your name.')).toBeVisible();
    await expect(page.getByText('Please enter your email.')).toBeVisible();

    await page.getByLabel('Full name').fill('Someone');
    await page.getByLabel('Email').fill(taken.email);
    await page.getByLabel('Password').fill('short');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Password must be at least 8 characters.')).toBeVisible();

    await page.getByLabel('Password').fill('long-enough-1');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('An account with this email already exists.')).toBeVisible();
  });

  test('doctors must give a registration number and then wait for approval', async ({ page }) => {
    const email = uniqueEmail('doc');
    await page.goto('/');
    await page.getByRole('tab', { name: 'Sign up' }).click();
    await page.getByRole('radio', { name: 'Doctor' }).click();
    await page.getByLabel('Full name').fill('Dr Newcomer');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('doctor-pass-1');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Please enter your medical registration number.')).toBeVisible();

    await page.getByLabel('Medical registration number').fill('KMC-99999');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Waiting for verification')).toBeVisible();
    await expect(page.getByText(/KMC-99999.*pending verification/).first()).toBeVisible();
  });
});

test.describe('password reset', () => {
  test('reset link sets a new password, is single-use, and the old password stops working', async ({ page, newAccount }) => {
    const u = await newAccount({ name: 'Resetter' });
    await page.goto('/');
    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await page.getByLabel('Email').fill(u.email);
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();

    const link = await emailedLink(u.email, /Reset your Sweety password/);
    await page.goto(link);
    await page.getByLabel('New password').fill('brand-new-pass-1');
    await page.getByRole('button', { name: 'Update password' }).click();
    await expect(page.getByRole('heading', { name: 'Password updated' })).toBeVisible();

    await page.goto(link); // same link again
    await page.getByLabel('New password').fill('another-pass-2');
    await page.getByRole('button', { name: 'Update password' }).click();
    await expect(page.getByText(/invalid or has expired/)).toBeVisible();

    await signIn(page, { email: u.email, password: u.password });
    await expect(page.getByText('Incorrect email or password.')).toBeVisible();
    await signIn(page, { email: u.email, password: 'brand-new-pass-1' });
    await expect(page.getByText('This month so far')).toBeVisible();
  });

  test('an unknown email gets the same answer and no email is sent', async ({ page }) => {
    const ghost = uniqueEmail('ghost');
    await page.goto('/forgot-password');
    await page.getByLabel('Email').fill(ghost);
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
    expect(emailsTo(ghost)).toHaveLength(0);
  });
});

test.describe('brute-force protection', () => {
  test('locks the account after 5 wrong passwords, even for the right one', async ({ page, newAccount }) => {
    const u = await newAccount({ name: 'Locked Out' });
    for (let i = 1; i <= 4; i++) {
      await signIn(page, { email: u.email, password: `wrong-pass-${i}` });
      await expect(page.getByText('Incorrect email or password.')).toBeVisible();
    }
    await signIn(page, { email: u.email, password: 'wrong-pass-5' });
    await expect(page.getByText(/Too many failed sign-in attempts. Try again in 15 minutes/)).toBeVisible();

    await signIn(page, u); // the correct password is refused while locked
    await expect(page.getByText(/Too many failed sign-in attempts/)).toBeVisible();
    await expect(page.getByText('This month so far')).toHaveCount(0);
  });
});

test.describe('login page layout', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('the brand headline does not move when switching between sign in, sign up and doctor', async ({ page }) => {
    await page.goto('/');
    const top = () => page.locator('h2').evaluate((el) => Math.round(el.getBoundingClientRect().top + window.scrollY));
    const first = await top();
    await page.getByRole('tab', { name: 'Sign up' }).click();
    await page.waitForTimeout(450);
    expect(await top()).toBe(first);
    await page.getByRole('radio', { name: 'Doctor' }).click();
    await page.waitForTimeout(450);
    expect(await top()).toBe(first);
    await page.getByRole('radio', { name: 'Patient' }).click();
    await page.getByRole('tab', { name: 'Sign in' }).click();
    await page.waitForTimeout(450);
    expect(await top()).toBe(first);
  });

  test('the tabs themselves do not jump while the form animates', async ({ page }) => {
    await page.goto('/');
    const tabY = () => page.getByRole('tab', { name: 'Sign in' }).evaluate((el) => Math.round(el.getBoundingClientRect().y));
    const y = await tabY();
    await page.getByRole('tab', { name: 'Sign up' }).click();
    for (let i = 0; i < 6; i++) { expect(await tabY()).toBe(y); await page.waitForTimeout(60); }
  });
});
