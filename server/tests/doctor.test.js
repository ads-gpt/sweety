import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { pool } from '../src/db/pool.js';
import { migrate } from '../src/db/migrate.js';
import { setDoctorStatus } from '../src/db/verify-doctor.js';
import { api, auth, reading, signup, verifiedDoctor, post } from './helpers.js';

beforeAll(async () => { await migrate(); });
afterAll(async () => { await pool.end(); });
beforeEach(async () => { await pool.query('TRUNCATE users RESTART IDENTITY CASCADE'); });

describe('doctor role', () => {
  it('lets a verified doctor see only patients who shared with them', async () => {
    const patient = await signup('patient');
    const other = await signup('patient');
    const doctor = await verifiedDoctor({ email: 'doc@example.com' });
    await post(patient.token, reading({ value: 123 }));

    const url = (id) => `/api/reports/daily?date=2026-01-10&patientId=${id}`;
    expect((await api().get(url(patient.user.id)).set(auth(doctor.token))).status).toBe(403);

    expect((await api().post('/api/me/doctors').set(auth(patient.token)).send({ email: 'doc@example.com' })).status).toBe(201);

    const ok = await api().get(url(patient.user.id)).set(auth(doctor.token));
    expect(ok.status).toBe(200);
    expect(ok.body.stats.highest).toBe(123);
    expect((await api().get(url(other.user.id)).set(auth(doctor.token))).status).toBe(403);

    const list = await api().get('/api/doctor/patients').set(auth(doctor.token));
    expect(list.body.data.map((p) => p.id)).toEqual([patient.user.id]);

    await api().delete(`/api/me/doctors/${doctor.user.id}`).set(auth(patient.token));
    expect((await api().get(url(patient.user.id)).set(auth(doctor.token))).status).toBe(403);
  });

  it('keeps doctors out of patient endpoints and patients out of each other reports', async () => {
    const doctor = await verifiedDoctor();
    const a = await signup();
    const b = await signup();
    expect((await api().get('/api/readings').set(auth(doctor.token))).status).toBe(403);
    expect((await api().get(`/api/reports/daily?patientId=${b.user.id}`).set(auth(a.token))).status).toBe(403);
  });
});

describe('doctor verification', () => {
  it('requires a registration number and starts doctors as pending', async () => {
    const missing = await api().post('/api/auth/signup').send({ name: 'D', email: 'd@example.com', password: 'secret123', role: 'doctor' });
    expect(missing.status).toBe(400);
    expect(missing.body.error.message).toBe('Please enter your medical registration number.');

    const d = await signup('doctor');
    expect(d.user).toMatchObject({ role: 'doctor', doctorStatus: 'pending', licenseNumber: 'REG-1' });
  });

  it('blocks pending doctors from patient data and from receiving shares until approved', async () => {
    const patient = await signup();
    const doc = await signup('doctor', { email: 'pending@example.com' });

    const share = await api().post('/api/me/doctors').set(auth(patient.token)).send({ email: 'pending@example.com' });
    expect(share.status).toBe(403);
    expect(share.body.error.message).toMatch(/pending verification/);
    expect((await api().get('/api/doctor/patients').set(auth(doc.token))).status).toBe(403);

    expect(await setDoctorStatus('pending@example.com', 'verified')).toBeTruthy();
    expect((await api().post('/api/me/doctors').set(auth(patient.token)).send({ email: 'pending@example.com' })).status).toBe(201);
    expect((await api().get('/api/doctor/patients').set(auth(doc.token))).status).toBe(200);
  });

  it('a rejected doctor cannot receive shares', async () => {
    const patient = await signup();
    await signup('doctor', { email: 'bad@example.com' });
    await setDoctorStatus('bad@example.com', 'rejected');
    expect((await api().post('/api/me/doctors').set(auth(patient.token)).send({ email: 'bad@example.com' })).status).toBe(403);
  });
});

describe('doctor comments', () => {
  async function shared() {
    const patient = await signup();
    const doctor = await verifiedDoctor({ name: 'Dr Who', email: 'who@example.com' });
    await api().post('/api/me/doctors').set(auth(patient.token)).send({ email: 'who@example.com' });
    return { patient, doctor };
  }

  it('shows a comment in the patient report and recent comments, and lets the doctor delete it', async () => {
    const { patient, doctor } = await shared();
    await post(patient.token, reading({ date: '2026-01-10' }));
    const res = await api().post(`/api/doctor/patients/${patient.user.id}/comments`).set(auth(doctor.token))
      .send({ date: '2026-01-10', body: 'Well done this week.' });
    expect(res.status).toBe(201);
    expect(res.body.comment).toMatchObject({ date: '2026-01-10', body: 'Well done this week.', doctor: { name: 'Dr Who' } });

    const report = await api().get('/api/reports/daily?date=2026-01-10').set(auth(patient.token));
    expect(report.body.comments.map((c) => c.body)).toEqual(['Well done this week.']);
    // A different day does not include it.
    expect((await api().get('/api/reports/daily?date=2026-01-11').set(auth(patient.token))).body.comments).toEqual([]);

    const mine = await api().get('/api/me/comments').set(auth(patient.token));
    expect(mine.body.data).toHaveLength(1);

    expect((await api().delete(`/api/doctor/comments/${res.body.comment.id}`).set(auth(doctor.token))).status).toBe(204);
    expect((await api().get('/api/me/comments').set(auth(patient.token))).body.data).toHaveLength(0);
  });

  it('refuses comments for patients who did not share, empty bodies and future dates; only the author can delete', async () => {
    const { patient, doctor } = await shared();
    const stranger = await signup();
    const url = (id) => `/api/doctor/patients/${id}/comments`;
    expect((await api().post(url(stranger.user.id)).set(auth(doctor.token)).send({ date: '2026-01-10', body: 'hi' })).status).toBe(403);
    expect((await api().post(url(patient.user.id)).set(auth(doctor.token)).send({ date: '2026-01-10', body: '  ' })).body.error.message).toBe('Please write a comment.');
    expect((await api().post(url(patient.user.id)).set(auth(doctor.token)).send({ date: '2999-01-01', body: 'hi' })).body.error.message).toBe('Date cannot be in the future.');

    const c = await api().post(url(patient.user.id)).set(auth(doctor.token)).send({ date: '2026-01-10', body: 'ok' });
    const other = await verifiedDoctor();
    expect((await api().delete(`/api/doctor/comments/${c.body.comment.id}`).set(auth(other.token))).status).toBe(404);
    // Patients cannot write comments.
    expect((await api().post(url(patient.user.id)).set(auth(patient.token)).send({ date: '2026-01-10', body: 'x' })).status).toBe(403);
  });
});
