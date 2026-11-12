import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { pool } from '../src/db/pool.js';
import { migrate } from '../src/db/migrate.js';
import { outbox } from '../src/lib/mailer.js';
import { api, auth, signup, reading, post } from './helpers.js';

beforeAll(async () => { await migrate(); });
afterAll(async () => { await pool.end(); });
beforeEach(async () => {
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
  outbox.length = 0;
});

const cookieOf = (res) => (res.headers['set-cookie'] || []).find((c) => c.startsWith('sweety_session='));
const cookieHeader = (res) => cookieOf(res).split(';')[0];
const login = (email, password = 'secret123') => api().post('/api/auth/login').send({ email, password });

describe('httpOnly session cookie', () => {
  it('sets an httpOnly, SameSite=Lax cookie on login and signup, and it authenticates requests', async () => {
    const u = await signup('patient', { email: 'cookie@example.com' });
    const c = cookieOf(u.res);
    expect(c).toMatch(/HttpOnly/i);
    expect(c).toMatch(/SameSite=Lax/i);
    expect(c).toMatch(/Path=\//);
    expect(c).not.toMatch(/Secure/i); // only forced on in production

    const res = await login('cookie@example.com');
    const me = await api().get('/api/auth/me').set('Cookie', cookieHeader(res));
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('cookie@example.com');
  });

  it('still accepts a Bearer token for API clients, and rejects a missing or garbage credential', async () => {
    const u = await signup();
    expect((await api().get('/api/auth/me').set(auth(u.token))).status).toBe(200);
    expect((await api().get('/api/auth/me')).status).toBe(401);
    expect((await api().get('/api/auth/me').set('Cookie', 'sweety_session=not-a-jwt')).status).toBe(401);
  });

  it('logout clears the cookie', async () => {
    const res = await api().post('/api/auth/logout');
    expect(res.status).toBe(204);
    expect(cookieOf(res)).toMatch(/sweety_session=;/);
  });

  it('marks every API response no-store and echoes a request id', async () => {
    const u = await signup();
    const res = await api().get('/api/readings').set(auth(u.token)).set('X-Request-Id', 'abc-123');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-request-id']).toBe('abc-123');
    expect((await api().get('/api/health')).headers['x-request-id']).toBeTruthy();
  });
});

describe('CSRF guard', () => {
  it('blocks state-changing requests from untrusted origins, allows the web app origin and tool calls', async () => {
    const u = await signup();
    const evil = await api().post('/api/readings').set(auth(u.token)).set('Origin', 'https://evil.example').send(reading());
    expect(evil.status).toBe(403);
    expect(evil.body.error.message).toMatch(/untrusted origin/);

    const ours = await api().post('/api/readings').set(auth(u.token)).set('Origin', 'http://localhost:5173').send(reading());
    expect(ours.status).toBe(201);
    // no Origin header (curl, server to server): needs only a valid credential
    expect((await post(u.token, reading({ slot: 'after_lunch' }))).status).toBe(201);
    // reads are never blocked by this guard
    expect((await api().get('/api/readings').set(auth(u.token)).set('Origin', 'https://evil.example')).status).toBe(200);
  });

  it('rejects form-encoded bodies (a cross-site <form> cannot send JSON)', async () => {
    const u = await signup();
    const res = await api().post('/api/readings').set(auth(u.token)).type('form').send('date=2026-01-10&slot=morning&value=100');
    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/JSON/);
  });
});

describe('account lockout', () => {
  it('locks after 5 wrong passwords, even for the right password, and says how long', async () => {
    await signup('patient', { email: 'lock@example.com' });
    for (let i = 1; i <= 4; i++) {
      const r = await login('lock@example.com', 'wrong-pass');
      expect(r.status).toBe(401);
      expect(r.body.error.message).toBe('Incorrect email or password.');
    }
    const fifth = await login('lock@example.com', 'wrong-pass');
    expect(fifth.status).toBe(429);
    expect(fifth.body.error.code).toBe('LOCKED');
    expect(fifth.body.error.message).toMatch(/Try again in 15 minutes/);

    const right = await login('lock@example.com', 'secret123');
    expect(right.status).toBe(429);
  });

  it('does not lock unknown emails (no account enumeration) and resets the counter on success', async () => {
    for (let i = 0; i < 8; i++) expect((await login('ghost@example.com', 'whatever1')).status).toBe(401);

    await signup('patient', { email: 'ok@example.com' });
    for (let i = 0; i < 4; i++) await login('ok@example.com', 'wrong-pass');
    expect((await login('ok@example.com')).status).toBe(200); // success resets
    for (let i = 0; i < 4; i++) expect((await login('ok@example.com', 'wrong-pass')).status).toBe(401);
    expect((await login('ok@example.com')).status).toBe(200);
  });

  it('unlocks when the lock expires, and a password reset clears it immediately', async () => {
    await signup('patient', { email: 'expire@example.com' });
    for (let i = 0; i < 5; i++) await login('expire@example.com', 'wrong-pass');
    expect((await login('expire@example.com')).status).toBe(429);

    await pool.query(`UPDATE users SET locked_until = now() - interval '1 minute' WHERE email = 'expire@example.com'`);
    expect((await login('expire@example.com')).status).toBe(200);

    for (let i = 0; i < 5; i++) await login('expire@example.com', 'wrong-pass');
    outbox.length = 0;
    await api().post('/api/auth/forgot-password').send({ email: 'expire@example.com' });
    const token = /token=([a-f0-9]+)/.exec(outbox[0].text)[1];
    await api().post('/api/auth/reset-password').send({ token, password: 'brand-new-pass' });
    expect((await login('expire@example.com', 'brand-new-pass')).status).toBe(200);
  });
});

describe('session revocation', () => {
  it('changing the password signs out other devices but keeps this one signed in', async () => {
    const u = await signup('patient', { email: 'rev@example.com' });
    const other = (await login('rev@example.com')).body.token; // a second device

    const change = await api().post('/api/auth/change-password').set(auth(u.token)).send({ currentPassword: 'secret123', newPassword: 'brand-new-pass' });
    expect(change.status).toBe(200);
    expect((await api().get('/api/auth/me').set(auth(u.token))).status).toBe(401);
    expect((await api().get('/api/auth/me').set(auth(other))).status).toBe(401);
    // the browser that made the change gets a fresh cookie
    expect((await api().get('/api/auth/me').set('Cookie', cookieHeader(change))).status).toBe(200);
  });

  it('resetting a forgotten password signs out every session', async () => {
    const u = await signup('patient', { email: 'forgot@example.com' });
    outbox.length = 0;
    await api().post('/api/auth/forgot-password').send({ email: 'forgot@example.com' });
    const token = /token=([a-f0-9]+)/.exec(outbox[0].text)[1];
    await api().post('/api/auth/reset-password').send({ token, password: 'brand-new-pass' });
    expect((await api().get('/api/auth/me').set(auth(u.token))).status).toBe(401);
  });

  it('"sign out everywhere" revokes all sessions', async () => {
    const u = await signup('patient', { email: 'all@example.com' });
    const second = (await login('all@example.com')).body.token;
    expect((await api().post('/api/auth/logout-all').set(auth(u.token))).status).toBe(204);
    expect((await api().get('/api/auth/me').set(auth(second))).status).toBe(401);
    expect((await login('all@example.com')).status).toBe(200); // can sign in again
  });
});
