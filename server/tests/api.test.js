import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { migrate } from '../src/db/migrate.js';
import { today } from '../src/lib/dates.js';

const app = createApp();
const api = () => request(app);

let seq = 0;
async function signup(role = 'patient', overrides = {}) {
  seq += 1;
  const res = await api().post('/api/auth/signup').send({
    name: `User ${seq}`, email: `user${seq}@example.com`, password: 'secret123', role, ...overrides,
  });
  return { token: res.body.token, user: res.body.user, res };
}
const auth = (t) => ({ Authorization: `Bearer ${t}` });
const reading = (o = {}) => ({ date: '2026-01-10', slot: 'morning', value: 110, ...o });

beforeAll(async () => { await migrate(); });
afterAll(async () => { await pool.end(); });
beforeEach(async () => { await pool.query('TRUNCATE users RESTART IDENTITY CASCADE'); });

describe('auth', () => {
  it('registers, hashes the password and logs in', async () => {
    const { res } = await signup('patient', { email: 'a@example.com', password: 'secret123' });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'a@example.com', role: 'patient' });
    expect(res.body.user.password_hash).toBeUndefined();

    const { rows } = await pool.query('SELECT password_hash FROM users WHERE email = $1', ['a@example.com']);
    expect(rows[0].password_hash).not.toContain('secret123');
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$/);

    const login = await api().post('/api/auth/login').send({ email: 'a@example.com', password: 'secret123' });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeTruthy();
  });

  it('rejects duplicate emails, short passwords and wrong credentials', async () => {
    await signup('patient', { email: 'dup@example.com' });
    const dup = await signup('patient', { email: 'DUP@example.com' });
    expect(dup.res.status).toBe(409);
    const short = await api().post('/api/auth/signup').send({ name: 'x', email: 'x@example.com', password: '123' });
    expect(short.status).toBe(400);
    const bad = await api().post('/api/auth/login').send({ email: 'dup@example.com', password: 'nope-nope' });
    expect(bad.status).toBe(401);
  });

  it('requires a token for readings', async () => {
    expect((await api().get('/api/readings')).status).toBe(401);
  });
});

describe('reading validation', () => {
  let token;
  beforeEach(async () => { ({ token } = await signup()); });
  const post = (body) => api().post('/api/readings').set(auth(token)).send(body);

  it('requires a value', async () => {
    const res = await post({ date: '2026-01-10', slot: 'morning' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Please enter a glucose value.');
    expect((await post(reading({ value: '' }))).body.error.message).toBe('Please enter a glucose value.');
  });

  it.each([39, 601, 0, -5])('rejects out-of-range value %s', async (value) => {
    const res = await post(reading({ value }));
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Value must be between 40 and 600 mg/dl.');
  });

  it('accepts the boundaries 40 and 600', async () => {
    expect((await post(reading({ value: 40 }))).status).toBe(201);
    expect((await post(reading({ slot: 'after_lunch', value: 600 }))).status).toBe(201);
  });

  it('rejects decimals', async () => {
    const res = await post(reading({ value: 100.5 }));
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/whole number/);
  });

  it('rejects future dates', async () => {
    const res = await post(reading({ date: '2999-01-01' }));
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Date cannot be in the future.');
  });

  it('allows today', async () => {
    expect((await post(reading({ date: today() }))).status).toBe(201);
  });

  it('rejects a second reading for the same slot and day', async () => {
    await post(reading({ slot: 'after_lunch' }));
    const res = await post(reading({ slot: 'after_lunch', value: 150 }));
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('You already have an After lunch reading for this date.');
  });

  it('rejects a 5th reading on one day', async () => {
    for (const slot of ['morning', 'after_breakfast', 'after_lunch', 'after_dinner']) {
      expect((await post(reading({ slot }))).status).toBe(201);
    }
    const res = await post(reading({ slot: 'morning' }));
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('You can add only 4 readings per day.');
  });

  it('does not let concurrent requests double-book a slot', async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => post(reading({ slot: 'after_dinner' }))));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
  });
});

describe('reading CRUD and isolation', () => {
  it('creates, lists (paginated), edits and deletes', async () => {
    const { token } = await signup();
    const created = await api().post('/api/readings').set(auth(token)).send(reading());
    const id = created.body.reading.id;
    expect(created.body.reading.slotLabel).toBe('Morning (fasting)');

    for (let d = 11; d <= 14; d++) await api().post('/api/readings').set(auth(token)).send(reading({ date: `2026-01-${d}` }));
    const page = await api().get('/api/readings?page=1&limit=2').set(auth(token));
    expect(page.body.data).toHaveLength(2);
    expect(page.body.pagination).toMatchObject({ page: 1, limit: 2, total: 5, totalPages: 3 });
    expect(page.body.data[0].date).toBe('2026-01-14'); // newest first

    const edited = await api().put(`/api/readings/${id}`).set(auth(token)).send(reading({ value: 222, slot: 'after_dinner' }));
    expect(edited.status).toBe(200);
    expect(edited.body.reading).toMatchObject({ value: 222, slot: 'after_dinner' });

    expect((await api().delete(`/api/readings/${id}`).set(auth(token))).status).toBe(204);
    expect((await api().get(`/api/readings/${id}`).set(auth(token))).status).toBe(404);
  });

  it('allows editing a reading without tripping the slot rule on itself', async () => {
    const { token } = await signup();
    const { body } = await api().post('/api/readings').set(auth(token)).send(reading());
    const res = await api().put(`/api/readings/${body.reading.id}`).set(auth(token)).send(reading({ value: 130 }));
    expect(res.status).toBe(200);
  });

  it("never exposes or modifies another user's readings", async () => {
    const a = await signup();
    const b = await signup();
    const { body } = await api().post('/api/readings').set(auth(a.token)).send(reading());
    const id = body.reading.id;

    expect((await api().get('/api/readings').set(auth(b.token))).body.data).toHaveLength(0);
    expect((await api().get(`/api/readings/${id}`).set(auth(b.token))).status).toBe(404);
    expect((await api().put(`/api/readings/${id}`).set(auth(b.token)).send(reading())).status).toBe(404);
    expect((await api().delete(`/api/readings/${id}`).set(auth(b.token))).status).toBe(404);
    expect((await api().get(`/api/readings/${id}`).set(auth(a.token))).status).toBe(200);
  });
});

describe('reports', () => {
  async function seedOctober(token) {
    const rows = [
      ['2026-09-03', 'morning', 100], ['2026-09-30', 'after_dinner', 141],        // previous month
      ['2026-10-01', 'morning', 90], ['2026-10-10', 'after_lunch', 150],          // month to date
      ['2026-10-15', 'morning', 100], ['2026-10-15', 'after_breakfast', 141], ['2026-10-15', 'after_dinner', 120], // selected day
      ['2026-10-16', 'morning', 300],                                              // after selected date
    ];
    for (const [date, slot, value] of rows) {
      const r = await api().post('/api/readings').set(auth(token)).send({ date, slot, value });
      expect(r.status).toBe(201);
    }
  }

  it('daily report lists readings and stats', async () => {
    const { token } = await signup();
    await seedOctober(token);
    const res = await api().get('/api/reports/daily?date=2026-10-15').set(auth(token));
    expect(res.body).toMatchObject({ from: '2026-10-15', to: '2026-10-15', empty: false });
    expect(res.body.stats).toEqual({ count: 3, highest: 141, lowest: 100, average: 120.3 });
    expect(res.body.readings.map((r) => r.slot)).toEqual(['morning', 'after_breakfast', 'after_dinner']);
  });

  it('month-to-date covers the 1st up to the selected date only', async () => {
    const { token } = await signup();
    await seedOctober(token);
    const res = await api().get('/api/reports/month-to-date?date=2026-10-15').set(auth(token));
    expect(res.body).toMatchObject({ from: '2026-10-01', to: '2026-10-15' });
    expect(res.body.stats).toEqual({ count: 5, highest: 150, lowest: 90, average: 120.2 });
  });

  it('monthly covers the whole previous month', async () => {
    const { token } = await signup();
    await seedOctober(token);
    const res = await api().get('/api/reports/monthly?date=2026-10-15').set(auth(token));
    expect(res.body).toMatchObject({ from: '2026-09-01', to: '2026-09-30' });
    expect(res.body.stats).toEqual({ count: 2, highest: 141, lowest: 100, average: 120.5 });
  });

  it('returns an empty state when there are no readings', async () => {
    const { token } = await signup();
    const res = await api().get('/api/reports/monthly?date=2026-10-15').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ empty: true, stats: null, readings: [] });
  });

  it('validates the report type and date', async () => {
    const { token } = await signup();
    expect((await api().get('/api/reports/weekly').set(auth(token))).status).toBe(400);
    expect((await api().get('/api/reports/daily?date=2999-01-01').set(auth(token))).status).toBe(400);
  });
});

