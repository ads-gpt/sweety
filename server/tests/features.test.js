import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { pool } from '../src/db/pool.js';
import { migrate } from '../src/db/migrate.js';
import { today } from '../src/lib/dates.js';
import { outbox } from '../src/lib/mailer.js';
import { runReminderJob, findDueReminders } from '../src/jobs/reminders.js';
import { estimatedA1c } from '../src/lib/targets.js';
import { api, auth, reading, signup, post } from './helpers.js';

beforeAll(async () => { await migrate(); });
afterAll(async () => { await pool.end(); });
beforeEach(async () => {
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
  outbox.length = 0;
});

const patch = (token, body) => api().patch('/api/me/settings').set(auth(token)).send(body);
const tokenFrom = (mail) => /token=([a-f0-9]+)/.exec(mail.text)[1];

describe('per-user timezone', () => {
  it('judges "future" and "today" in the user\'s own timezone', async () => {
    const ahead = 'Pacific/Kiritimati'; // UTC+14
    const behind = 'Pacific/Pago_Pago'; // UTC-11
    const utc = await signup('patient');
    const east = await signup('patient', { timezone: ahead });
    const west = await signup('patient', { timezone: behind });
    expect(east.user.timezone).toBe(ahead);

    // At any instant either the +14 zone is a day ahead of UTC or the -11 zone is a day behind.
    const aheadDate = today(ahead);
    if (aheadDate > today('UTC')) {
      expect((await post(east.token, reading({ date: aheadDate }))).status).toBe(201);
      const rejected = await post(utc.token, reading({ date: aheadDate }));
      expect(rejected.body.error.message).toBe('Date cannot be in the future.');
    }
    const behindDate = today(behind);
    if (behindDate < today('UTC')) {
      expect((await post(utc.token, reading({ date: today('UTC') }))).status).toBe(201);
      expect((await post(west.token, reading({ date: today('UTC') }))).body.error.message).toBe('Date cannot be in the future.');
    }
    expect(aheadDate > today('UTC') || behindDate < today('UTC')).toBe(true);
  });

  it('defaults report dates to the user\'s local today', async () => {
    const tz = 'Pacific/Kiritimati';
    const u = await signup('patient', { timezone: tz });
    const res = await api().get('/api/reports/daily').set(auth(u.token));
    expect(res.body.selectedDate).toBe(today(tz));
  });

  it('rejects unknown timezones at sign-up and in settings, and accepts a change', async () => {
    const bad = await api().post('/api/auth/signup').send({ name: 'x', email: 'tz@example.com', password: 'secret123', timezone: 'Mars/Olympus' });
    expect(bad.status).toBe(400);
    const u = await signup();
    expect((await patch(u.token, { timezone: 'Nope/Zone' })).status).toBe(400);
    const ok = await patch(u.token, { timezone: 'Asia/Kolkata' });
    expect(ok.body.user.timezone).toBe('Asia/Kolkata');
  });
});

describe('settings and target ranges', () => {
  it('stores targets and enforces low < high and sane bounds', async () => {
    const u = await signup();
    expect(u.user.settings).toMatchObject({ fastingLow: 70, fastingHigh: 130, postLow: 70, postHigh: 180 });
    const ok = await patch(u.token, { fastingLow: 80, fastingHigh: 120 });
    expect(ok.body.user.settings).toMatchObject({ fastingLow: 80, fastingHigh: 120, postHigh: 180 });
    expect((await patch(u.token, { fastingLow: 130, fastingHigh: 100 })).body.error.message).toBe('Fasting low must be below fasting high.');
    expect((await patch(u.token, { postHigh: 9999 })).status).toBe(400);
    expect((await patch(u.token, { reminderTime: '25:00' })).status).toBe(400);
  });
});

describe('time in range and estimated A1c', () => {
  it('uses fasting vs after-meal ranges and the user\'s own targets', async () => {
    const u = await signup();
    await post(u.token, reading({ slot: 'morning', value: 120 }));          // fasting 70-130  -> in range
    await post(u.token, reading({ slot: 'after_breakfast', value: 150 }));  // post    70-180  -> in range
    await post(u.token, reading({ slot: 'after_lunch', value: 200 }));      // high
    await post(u.token, reading({ slot: 'after_dinner', value: 60 }));      // low
    const r = (await api().get('/api/reports/daily?date=2026-01-10').set(auth(u.token))).body;
    expect(r.timeInRange).toMatchObject({ inRange: 50, high: 25, low: 25 });
    expect(r.readings.map((x) => x.status)).toEqual(['ok', 'ok', 'high', 'low']);

    // Tighten the fasting range: the same 120 fasting reading is now high (and the cache is invalidated).
    await patch(u.token, { fastingLow: 70, fastingHigh: 110 });
    const r2 = (await api().get('/api/reports/daily?date=2026-01-10').set(auth(u.token))).body;
    expect(r2.timeInRange.inRange).toBe(25);
    expect(r2.targets.fastingHigh).toBe(110);
  });

  it('estimates A1c only from 10+ readings', async () => {
    expect(estimatedA1c(154, 9)).toBeNull();
    expect(estimatedA1c(154, 10)).toBe(7); // (154 + 46.7) / 28.7 = 6.99
    const u = await signup();
    for (let d = 1; d <= 3; d++) {
      for (const slot of ['morning', 'after_breakfast', 'after_lunch', 'after_dinner']) {
        await post(u.token, reading({ date: `2026-01-0${d}`, slot, value: 154 }));
      }
    }
    const mtd = (await api().get('/api/reports/month-to-date?date=2026-01-05').set(auth(u.token))).body;
    expect(mtd.stats.count).toBe(12);
    expect(mtd.estimatedA1c).toBe(7);
    const day = (await api().get('/api/reports/daily?date=2026-01-01').set(auth(u.token))).body;
    expect(day.estimatedA1c).toBeNull();
  });

  it('returns null time-in-range for an empty period', async () => {
    const u = await signup();
    const r = (await api().get('/api/reports/monthly?date=2026-01-10').set(auth(u.token))).body;
    expect(r).toMatchObject({ empty: true, timeInRange: null, estimatedA1c: null });
  });
});

describe('tags, search and CSV export', () => {
  it('saves tags, rejects unknown ones, filters by tag and searches notes', async () => {
    const u = await signup();
    const a = await post(u.token, reading({ slot: 'morning', tags: ['exercise', 'exercise', 'poor_sleep'], notes: 'Felt 100% fine' }));
    expect(a.body.reading.tags).toEqual(['exercise', 'poor_sleep']); // de-duplicated
    await post(u.token, reading({ slot: 'after_lunch', tags: ['big_meal'], notes: 'Wedding lunch' }));
    expect((await post(u.token, reading({ slot: 'after_dinner', tags: ['nonsense'] }))).body.error.message).toBe('Unknown tag.');

    const byTag = await api().get('/api/readings?tag=big_meal').set(auth(u.token));
    expect(byTag.body.data.map((r) => r.slot)).toEqual(['after_lunch']);
    const bySearch = await api().get('/api/readings?q=wedding').set(auth(u.token));
    expect(bySearch.body.data).toHaveLength(1);
    // % is literal, not a wildcard
    expect((await api().get('/api/readings?q=100%25').set(auth(u.token))).body.data).toHaveLength(1);
    expect((await api().get('/api/readings?q=%25').set(auth(u.token))).body.data).toHaveLength(1);

    const edited = await api().put(`/api/readings/${a.body.reading.id}`).set(auth(u.token)).send(reading({ tags: [], notes: 'x' }));
    expect(edited.body.reading.tags).toEqual([]);
  });

  it('exports a CSV of the user\'s own readings and neutralises formulas', async () => {
    const u = await signup();
    const other = await signup();
    await post(u.token, reading({ slot: 'morning', value: 99, tags: ['exercise'], notes: '=HYPERLINK("x")' }));
    await post(u.token, reading({ slot: 'after_lunch', value: 210, notes: 'plain, with comma' }));
    await post(other.token, reading({ value: 555 }));

    const res = await api().get('/api/readings/export.csv').set(auth(u.token));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    const lines = res.text.trim().split('\n');
    expect(lines[0]).toBe('date,slot,value_mg_dl,status,tags,notes');
    expect(lines).toHaveLength(3);
    expect(res.text).not.toContain('555');
    expect(lines[1]).toContain(`'=HYPERLINK`);
    expect(lines[2]).toContain('"plain, with comma"');
    expect(lines[2]).toContain(',high,');
  });
});

describe('email verification', () => {
  it('sends a link at sign-up, verifies once, and supports resend', async () => {
    const u = await signup('patient', { email: 'verify@example.com' });
    expect(u.user.emailVerified).toBe(false);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ to: 'verify@example.com', subject: 'Verify your Sweety email' });

    const token = tokenFrom(outbox[0]);
    expect((await api().post('/api/auth/verify-email').send({ token: 'nope' })).status).toBe(400);
    expect((await api().post('/api/auth/verify-email').send({ token })).status).toBe(200);
    expect((await api().post('/api/auth/verify-email').send({ token })).status).toBe(400); // single use
    expect((await api().get('/api/auth/me').set(auth(u.token))).body.user.emailVerified).toBe(true);

    const again = await api().post('/api/auth/resend-verification').set(auth(u.token));
    expect(again.body.alreadyVerified).toBe(true);
    expect(outbox).toHaveLength(1);
  });

  it('resends for unverified users', async () => {
    const u = await signup();
    outbox.length = 0;
    expect((await api().post('/api/auth/resend-verification').set(auth(u.token))).status).toBe(200);
    expect(outbox).toHaveLength(1);
  });
});

describe('password reset and change', () => {
  it('resets with a single-use emailed token and does not reveal unknown emails', async () => {
    const u = await signup('patient', { email: 'reset@example.com' });
    outbox.length = 0;

    const unknown = await api().post('/api/auth/forgot-password').send({ email: 'ghost@example.com' });
    expect(unknown.status).toBe(200);
    expect(outbox).toHaveLength(0);

    expect((await api().post('/api/auth/forgot-password').send({ email: 'reset@example.com' })).status).toBe(200);
    expect(outbox).toHaveLength(1);
    const token = tokenFrom(outbox[0]);

    expect((await api().post('/api/auth/reset-password').send({ token, password: 'short' })).status).toBe(400);
    expect((await api().post('/api/auth/reset-password').send({ token, password: 'brand-new-pass' })).status).toBe(200);
    expect((await api().post('/api/auth/reset-password').send({ token, password: 'another-pass-1' })).status).toBe(400); // used

    expect((await api().post('/api/auth/login').send({ email: 'reset@example.com', password: 'secret123' })).status).toBe(401);
    expect((await api().post('/api/auth/login').send({ email: 'reset@example.com', password: 'brand-new-pass' })).status).toBe(200);
    expect(u.token).toBeTruthy();
  });

  it('rejects expired reset tokens', async () => {
    await signup('patient', { email: 'late@example.com' });
    outbox.length = 0;
    await api().post('/api/auth/forgot-password').send({ email: 'late@example.com' });
    await pool.query(`UPDATE auth_tokens SET expires_at = now() - interval '1 minute' WHERE kind = 'reset'`);
    const res = await api().post('/api/auth/reset-password').send({ token: tokenFrom(outbox[0]), password: 'brand-new-pass' });
    expect(res.status).toBe(400);
  });

  it('changes the password only with the right current password', async () => {
    const u = await signup('patient', { email: 'chg@example.com' });
    const bad = await api().post('/api/auth/change-password').set(auth(u.token)).send({ currentPassword: 'wrong-pass', newPassword: 'brand-new-pass' });
    expect(bad.body.error.message).toBe('Your current password is incorrect.');
    const ok = await api().post('/api/auth/change-password').set(auth(u.token)).send({ currentPassword: 'secret123', newPassword: 'brand-new-pass' });
    expect(ok.status).toBe(200);
    expect((await api().post('/api/auth/login').send({ email: 'chg@example.com', password: 'brand-new-pass' })).status).toBe(200);
  });
});

describe('reminders', () => {
  // 14:45 UTC on 11 Nov 2026 is 20:15 in Kolkata (UTC+5:30), 09:45 in New York.
  const evening = new Date('2026-11-11T14:45:00Z');
  const noPush = async () => 0;
  const sent = [];
  const mail = async (m) => { sent.push(m); };
  const run = (now = evening, push = noPush) => runReminderJob({ now, mail, push, log: () => {} });

  beforeEach(() => { sent.length = 0; });

  it('reminds in each user\'s own local time, once a day, and only if readings are missing', async () => {
    const kolkata = await signup('patient', { timezone: 'Asia/Kolkata' });
    const newYork = await signup('patient', { timezone: 'America/New_York' });
    await signup('doctor');

    // Kolkata is past 20:00 and New York is not.
    expect((await findDueReminders(evening)).map((u) => u.id)).toEqual([kolkata.user.id]);
    const first = await run();
    expect(first).toEqual([{ userId: kolkata.user.id, logged: 0, channels: ['email'] }]);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(kolkata.email);

    // Not again on the same local day...
    expect(await run()).toEqual([]);
    // ...but New York gets theirs when 20:00 arrives there (01:00 UTC next day = 20:00 EST).
    const nyEvening = new Date('2026-11-12T01:30:00Z');
    expect((await run(nyEvening)).map((r) => r.userId)).toContain(newYork.user.id);
  });

  it('skips users who logged all four readings, disabled reminders, or are outside the 3-hour window', async () => {
    const full = await signup('patient', { timezone: 'Asia/Kolkata' });
    const off = await signup('patient', { timezone: 'Asia/Kolkata' });
    const late = await signup('patient', { timezone: 'Asia/Kolkata' });
    const date = '2026-11-11';
    for (const slot of ['morning', 'after_breakfast', 'after_lunch', 'after_dinner']) await post(full.token, reading({ date, slot }));
    await patch(off.token, { reminderEnabled: false });
    await patch(late.token, { reminderTime: '09:00' }); // 20:15 is 11h after 09:00 -> outside the window
    expect(await run()).toEqual([]);
  });

  it('honours the chosen channels and counts push only when a device received it', async () => {
    const u = await signup('patient', { timezone: 'Asia/Kolkata' });
    await patch(u.token, { reminderEmail: false, reminderPush: true });
    let pushed = 0;
    const result = await run(evening, async () => { pushed++; return 1; });
    expect(pushed).toBe(1);
    expect(sent).toHaveLength(0);
    expect(result[0].channels).toEqual(['push']);
  });

  it('reports "2 of 4" progress in the message', async () => {
    const u = await signup('patient', { timezone: 'Asia/Kolkata' });
    await post(u.token, reading({ date: '2026-11-11', slot: 'morning' }));
    await post(u.token, reading({ date: '2026-11-11', slot: 'after_lunch' }));
    await run();
    expect(sent[0].text).toContain('1 of 4'.replace('1', '2'));
  });
});

describe('push subscriptions', () => {
  it('exposes the public key and stores / removes a subscription', async () => {
    const u = await signup();
    const key = await api().get('/api/push/public-key').set(auth(u.token));
    expect(key.body.enabled).toBe(true);
    expect(key.body.publicKey).toBeTruthy();

    const sub = { endpoint: 'https://push.example.com/abc', keys: { p256dh: 'p', auth: 'a' } };
    expect((await api().post('/api/push/subscribe').set(auth(u.token)).send(sub)).status).toBe(201);
    expect((await api().post('/api/push/subscribe').set(auth(u.token)).send(sub)).status).toBe(201); // idempotent
    expect((await pool.query('SELECT COUNT(*)::int AS c FROM push_subscriptions')).rows[0].c).toBe(1);
    expect((await api().post('/api/push/subscribe').set(auth(u.token)).send({ endpoint: 'nope' })).status).toBe(400);
    expect((await api().post('/api/push/unsubscribe').set(auth(u.token)).send({ endpoint: sub.endpoint })).status).toBe(204);
    expect((await pool.query('SELECT COUNT(*)::int AS c FROM push_subscriptions')).rows[0].c).toBe(0);
    expect((await api().get('/api/push/public-key')).status).toBe(401);
  });
});
