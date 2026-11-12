import { test, expect, API_URL, DEMO, signIn } from '../fixtures.js';

test.describe('installable app', () => {
  test('has a valid manifest with real icons', async ({ page, request }) => {
    await page.goto('/');
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
    const manifest = await (await request.get('/manifest.webmanifest')).json();
    expect(manifest).toMatchObject({ short_name: 'Sweety', display: 'standalone', start_url: '/' });
    expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);
    for (const icon of manifest.icons.filter((i) => i.type === 'image/png')) {
      const res = await request.get(icon.src);
      expect(res.status(), icon.src).toBe(200);
      expect(res.headers()['content-type']).toBe('image/png');
    }
    await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute('href', '/favicon.svg');
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  });

  test('a service worker takes control and the app shell opens offline', async ({ page, context }) => {
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload(); // now controlled by the worker, which caches the build assets
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    await page.waitForTimeout(500);

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await context.setOffline(false);
  });

  test('the service worker never caches API data', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    const cachedApi = await page.evaluate(async () => {
      const out = [];
      for (const name of await caches.keys()) for (const req of await (await caches.open(name)).keys()) out.push(new URL(req.url).pathname);
      return out.filter((p) => p.startsWith('/api'));
    });
    expect(cachedApi).toEqual([]);
  });
});

test.describe('phone layout', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('bottom navigation works, nothing overflows sideways, and a reading can be added', async ({ page }) => {
    await signIn(page, DEMO.patient);
    await expect(page.getByText('This month so far')).toBeVisible();

    const nav = page.getByRole('navigation', { name: 'Main mobile' });
    await expect(nav).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main', exact: true })).toBeHidden();

    for (const [name, heading] of [['Readings', 'Readings'], ['Reports', 'Reports'], ['Care team', 'Care team'], ['Settings', 'Settings'], ['Dashboard', /Good (morning|afternoon|evening)/]]) {
      await nav.getByRole('link', { name }).click();
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth);
      expect(overflow, `${name} scrolls sideways`).toBeLessThanOrEqual(1);
    }
  });

  test('the sign-in screen fits a phone', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' }).last()).toBeInViewport();
    const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

test('the API health endpoint answers (sanity check for the test setup)', async ({ request }) => {
  expect((await request.get(`${API_URL}/api/health`)).ok()).toBe(true);
});
