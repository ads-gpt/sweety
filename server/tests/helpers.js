import request from 'supertest';
import { createApp } from '../src/app.js';
import { setDoctorStatus } from '../src/db/verify-doctor.js';

export const app = createApp();
export const api = () => request(app);
export const auth = (t) => ({ Authorization: `Bearer ${t}` });
export const reading = (o = {}) => ({ date: '2026-01-10', slot: 'morning', value: 110, ...o });

let seq = 1000;
export async function signup(role = 'patient', overrides = {}) {
  seq += 1;
  const res = await api().post('/api/auth/signup').send({
    name: `User ${seq}`,
    email: `user${seq}@example.com`,
    password: 'secret123',
    role,
    ...(role === 'doctor' ? { licenseNumber: 'REG-1' } : {}),
    ...overrides,
  });
  return { token: res.body.token, user: res.body.user, email: res.body.user?.email, res };
}

/** A doctor that an admin has already approved. */
export async function verifiedDoctor(overrides = {}) {
  const d = await signup('doctor', overrides);
  await setDoctorStatus(d.email, 'verified');
  return d;
}

export const post = (token, body) => api().post('/api/readings').set(auth(token)).send(body);
