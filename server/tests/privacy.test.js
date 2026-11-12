import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { pool } from '../src/db/pool.js';
import { migrate } from '../src/db/migrate.js';
import { outbox } from '../src/lib/mailer.js';
import { api, auth, signup, verifiedDoctor, reading, post } from './helpers.js';

beforeAll(async () => { await migrate(); });
afterAll(async () => { await pool.end(); });
beforeEach(async () => {
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
  outbox.length = 0;
});

const count = async (table, where = 'true', params = []) => (await pool.query(`SELECT COUNT(*)::int AS c FROM ${table} WHERE ${where}`, params)).rows[0].c;

async function shared() {
  const patient = await signup('patient', { email: 'pat@example.com', name: 'Pat Ient' });
  const doctor = await verifiedDoctor({ email: 'doc@example.com', name: 'Dr Who' });
  await api().post('/api/me/doctors').set(auth(patient.token)).send({ email: 'doc@example.com' });
  await post(patient.token, reading({ value: 130, tags: ['exercise'], notes: 'after walk' }));
  await api().post(`/api/doctor/patients/${patient.user.id}/comments`).set(auth(doctor.token)).send({ date: '2026-01-10', body: 'Looks good.' });
  return { patient, doctor };
}

describe('data export', () => {
  it('exports a patient\'s readings, shares and received comments - without secrets', async () => {
    const { patient } = await shared();
    const res = await api().get('/api/me/export').set(auth(patient.token));
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="sweety-data\.json"/);
    const data = JSON.parse(res.text);
    expect(data.profile).toMatchObject({ email: 'pat@example.com', role: 'patient' });
    expect(data.readings).toHaveLength(1);
    expect(data.readings[0]).toMatchObject({ date: '2026-01-10', slot: 'morning', value: 130, notes: 'after walk', tags: ['exercise'] });
    expect(data.sharedWith.map((d) => d.email)).toEqual(['doc@example.com']);
    expect(data.doctorComments.map((c) => c.body)).toEqual(['Looks good.']);
    expect(res.text).not.toMatch(/password|token_version|hash/i);
  });

  it('exports a doctor\'s patients and written comments, and requires sign-in', async () => {
    const { doctor } = await shared();
    const data = JSON.parse((await api().get('/api/me/export').set(auth(doctor.token))).text);
    expect(data.patients.map((p) => p.email)).toEqual(['pat@example.com']);
    expect(data.commentsWritten).toHaveLength(1);
    expect(data.readings).toBeUndefined();
    expect((await api().get('/api/me/export')).status).toBe(401);
  });
});

describe('account deletion', () => {
  it('needs the right password, then removes the account and everything it owns', async () => {
    const { patient } = await shared();
    const wrong = await api().delete('/api/me').set(auth(patient.token)).send({ password: 'nope-nope' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error).toMatchObject({ field: 'password', message: 'Your password is incorrect.' });
    expect(await count('users', 'id = $1', [patient.user.id])).toBe(1);

    outbox.length = 0;
    const res = await api().delete('/api/me').set(auth(patient.token)).send({ password: 'secret123' });
    expect(res.status).toBe(204);
    expect((res.headers['set-cookie'] || []).join()).toMatch(/sweety_session=;/);

    expect(await count('users', 'id = $1', [patient.user.id])).toBe(0);
    expect(await count('readings')).toBe(0);
    expect(await count('doctor_comments')).toBe(0);
    expect(await count('doctor_patients')).toBe(0);
    expect(outbox.map((m) => m.subject)).toContain('Your Sweety account has been deleted');

    expect((await api().get('/api/auth/me').set(auth(patient.token))).status).toBe(401);
    expect((await api().post('/api/auth/login').send({ email: 'pat@example.com', password: 'secret123' })).status).toBe(401);
  });

  it('deleting a doctor removes their comments from patients\' reports but keeps the patients\' readings', async () => {
    const { patient, doctor } = await shared();
    const before = await api().get('/api/reports/daily?date=2026-01-10').set(auth(patient.token));
    expect(before.body.comments).toHaveLength(1);

    expect((await api().delete('/api/me').set(auth(doctor.token)).send({ password: 'secret123' })).status).toBe(204);
    const after = await api().get('/api/reports/daily?date=2026-01-10').set(auth(patient.token));
    expect(after.body.comments).toEqual([]);
    expect(after.body.stats.count).toBe(1);
    expect((await api().get('/api/me/doctors').set(auth(patient.token))).body.data).toEqual([]);
  });

  it('requires authentication and a password', async () => {
    const u = await signup();
    expect((await api().delete('/api/me').send({ password: 'secret123' })).status).toBe(401);
    expect((await api().delete('/api/me').set(auth(u.token)).send({})).status).toBe(400);
  });
});
