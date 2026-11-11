import bcrypt from 'bcryptjs';
import { pool } from './pool.js';
import { migrate } from './migrate.js';
import { today } from '../lib/dates.js';
import { SLOT_KEYS } from '../lib/slots.js';

export const DEMO = {
  patient: { name: 'Demo Patient', email: 'demo@sweety.app', password: 'Password123!' },
  doctor: { name: 'Dr. Asha Rao', email: 'doctor@sweety.app', password: 'Password123!' },
};

// Deterministic pseudo-random so the demo data is the same on every run.
const rng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

const shiftDate = (iso, days) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

// Typical glucose pattern through the day (mg/dl) plus daily noise.
const BASE = { morning: 104, after_breakfast: 156, after_lunch: 148, after_dinner: 138 };

export async function seed({ days = 75 } = {}) {
  await migrate();
  const rand = rng(42);
  const hash = await bcrypt.hash(DEMO.patient.password, 10);

  const upsertUser = async (u, role) =>
    (await pool.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4)
       ON CONFLICT (lower(email)) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash
       RETURNING id`,
      [u.name, u.email, hash, role],
    )).rows[0].id;

  const patientId = await upsertUser(DEMO.patient, 'patient');
  const doctorId = await upsertUser(DEMO.doctor, 'doctor');
  await pool.query('INSERT INTO doctor_patients (doctor_id, patient_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [doctorId, patientId]);
  await pool.query('DELETE FROM readings WHERE user_id = $1', [patientId]);

  const end = today();
  let inserted = 0;
  for (let i = days; i >= 0; i--) {
    const date = shiftDate(end, -i);
    // Today is left partly empty so the demo shows an incomplete day; other days vary 2-4 readings.
    const count = i === 0 ? 2 : rand() < 0.1 ? 0 : rand() < 0.7 ? 4 : 3;
    const slots = SLOT_KEYS.slice(0, count);
    for (const slot of slots) {
      const value = Math.round(BASE[slot] + (rand() - 0.45) * 70);
      await pool.query(
        'INSERT INTO readings (user_id, reading_date, slot, value) VALUES ($1,$2,$3,$4)',
        [patientId, date, slot, Math.min(600, Math.max(40, value))],
      );
      inserted++;
    }
  }
  return { patientId, doctorId, inserted };
}

import { fileURLToPath } from 'node:url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed()
    .then(({ inserted }) => {
      console.log(`Seeded ${inserted} readings.`);
      console.log(`  Patient: ${DEMO.patient.email} / ${DEMO.patient.password}`);
      console.log(`  Doctor:  ${DEMO.doctor.email} / ${DEMO.doctor.password}`);
    })
    .catch((err) => {
      console.error('Seed failed:', err.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
