import { test, expect, API_URL, DEMO, signIn, apiReading, todayIn } from '../fixtures.js';

test.describe('session and browser storage', () => {
  test('the session is an httpOnly cookie, not readable by page scripts or stored in localStorage', async ({ page, patient }) => {
    void patient;
    await page.goto('/');
    await expect(page.getByText('This month so far')).toBeVisible();

    const cookie = (await page.context().cookies()).find((c) => c.name === 'sweety_session');
    expect(cookie, 'session cookie').toBeDefined();
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe('Lax');

    const exposed = await page.evaluate(() => ({
      cookie: document.cookie,
      local: Object.entries(localStorage).map(([k, v]) => `${k}=${v}`).join(' '),
      session: Object.entries(sessionStorage).map(([k, v]) => `${k}=${v}`).join(' '),
    }));
    expect(exposed.cookie).not.toContain('sweety_session');
    expect(exposed.local).not.toMatch(/token|jwt|eyJ/i);
    expect(exposed.session).not.toMatch(/token|jwt|eyJ/i);
  });

  test('signing out clears the session; protected pages then show the login screen', async ({ page, patient }) => {
    void patient;
    await page.goto('/readings');
    await expect(page.getByRole('heading', { name: 'Readings' })).toBeVisible();
    await page.getByRole('button', { name: 'Sign out' }).first().click();
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    expect((await page.context().cookies()).find((c) => c.name === 'sweety_session')).toBeUndefined();
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });

  test('the session survives a reload', async ({ page }) => {
    await signIn(page, DEMO.patient);
    await expect(page.getByText('This month so far')).toBeVisible();
    await page.reload();
    await expect(page.getByText('This month so far')).toBeVisible();
  });
});

test.describe('hostile input', () => {
  test('notes containing HTML are shown as text and never run', async ({ page, patient }) => {
    void patient;
    const payload = '<img src=x onerror="window.__pwned=1"><script>window.__pwned=2</script>';
    await apiReading(page, { date: todayIn('Asia/Kolkata'), slot: 'morning', value: 110, notes: payload.slice(0, 280) });
    await page.goto('/readings');
    await expect(page.getByRole('list', { name: 'Readings' })).toContainText('<img src=x');
    await expect(page.locator('img[src="x"]')).toHaveCount(0);
    expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  });
});

test.describe('API protections', () => {
  test('requests from another website are refused, and so are form posts', async ({ page, patient }) => {
    void patient;
    const cookieHeader = (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join('; ');
    const evil = await page.request.post(`${API_URL}/api/readings`, {
      headers: { Origin: 'https://evil.example', Cookie: cookieHeader },
      data: { date: todayIn('Asia/Kolkata'), slot: 'morning', value: 100 },
    });
    expect(evil.status()).toBe(403);
    expect((await evil.json()).error.message).toMatch(/untrusted origin/);

    const form = await page.request.post(`${API_URL}/api/readings`, { form: { date: todayIn('Asia/Kolkata'), slot: 'morning', value: '100' } });
    expect(form.status()).toBe(403);
  });

  test('API responses are never cached and carry a request id', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/readings`);
    expect(res.status()).toBe(401);
    expect(res.headers()['cache-control']).toBe('no-store');
    expect(res.headers()['x-request-id']).toBeTruthy();
    expect(res.headers()['x-content-type-options']).toBe('nosniff');
  });

  test('the page cannot call any other origin (CSP), and the API sends no CORS grant to other websites', async ({ page }) => {
    await page.goto('/');
    // connect-src 'self' means even the app's own API on another port is off limits for page scripts.
    const result = await page.evaluate(async (api) => {
      try { const r = await fetch(`${api}/api/health`); return `reached ${r.status}`; } catch (e) { return 'blocked'; }
    }, API_URL);
    expect(result).toBe('blocked');

    const evil = await page.request.get(`${API_URL}/api/health`, { headers: { Origin: 'https://evil.example' } });
    expect(evil.headers()['access-control-allow-origin']).toBeUndefined();
    const ours = await page.request.get(`${API_URL}/api/health`, { headers: { Origin: 'http://localhost:4173' } });
    expect(ours.headers()['access-control-allow-origin']).toBe('http://localhost:4173');
    expect(ours.headers()['access-control-allow-credentials']).toBe('true');
  });
});

test.describe('content security policy', () => {
  test('the production build ships strict security headers', async ({ request }) => {
    const res = await request.get('/');
    const h = res.headers();
    expect(h['content-security-policy']).toContain("script-src 'self'");
    expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(h['content-security-policy']).not.toMatch(/script-src[^;]*unsafe/);
    expect(h['x-frame-options']).toBe('DENY');
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });

  test('using the whole app triggers no CSP violations or console errors', async ({ page, patient }) => {
    void patient;
    const problems = [];
    page.on('console', (m) => ['error', 'warning'].includes(m.type()) && !/Failed to load resource/.test(m.text()) && problems.push(`${m.type()}: ${m.text()}`));
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    await page.addInitScript(() => {
      window.__csp = [];
      document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
    });

    await page.goto('/');
    await apiReading(page, { date: todayIn('Asia/Kolkata'), slot: 'morning', value: 120 });
    for (const route of ['/', '/readings', '/reports', '/care-team', '/settings']) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
    }
    await page.goto('/');
    await page.getByRole('button', { name: 'Add reading' }).first().click(); // opens a Radix dialog + select
    await page.getByRole('combobox', { name: /time slot/i }).click();
    await page.getByRole('option', { name: /After lunch/ }).click();
    await page.getByLabel(/Glucose value/).fill('50');
    await page.getByRole('button', { name: 'Save reading' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible(); // low alert dialog
    await page.getByRole('button', { name: 'OK, got it' }).click();
    await page.goto('/reports');
    await page.getByRole('tab', { name: 'Month to date' }).click();
    await expect(page.locator('svg.recharts-surface').first()).toBeVisible(); // chart renders

    expect(await page.evaluate(() => window.__csp)).toEqual([]);
    expect(problems).toEqual([]);
  });
});

test.describe('API documentation', () => {
  test('serves the OpenAPI spec and a working Swagger UI', async ({ page, request }) => {
    const spec = await (await request.get(`${API_URL}/api/docs/openapi.json`)).json();
    expect(spec.info.title).toBe('Sweety API');
    const operations = Object.values(spec.paths).reduce((n, p) => n + Object.keys(p).length, 0);
    expect(operations).toBeGreaterThan(30);
    expect(spec.paths['/readings'].post.responses['201']).toBeDefined();

    await page.goto(`${API_URL}/api/docs/`);
    await expect(page.locator('div.swagger-ui').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /Sweety API/ }).first()).toBeVisible();
    await expect(page.getByText('/readings/export.csv').first()).toBeVisible();
  });
});
