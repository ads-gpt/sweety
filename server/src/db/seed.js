import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';
import { migrate } from './migrate.js';
import { today, addDays } from '../lib/dates.js';
import { SLOT_KEYS } from '../lib/slots.js';

export const DEMO = {
  patient: { name: 'Demo Patient', email: 'demo@sweety.app', password: 'Password123!' },
  doctor: { name: 'Dr. Asha Rao', email: 'doctor@sweety.app', password: 'Password123!', license: 'KMC-48213' },
  pendingDoctor: { name: 'Dr. Vikram Shah', email: 'newdoc@sweety.app', password: 'Password123!', license: 'KMC-77120' },
  timezone: 'Asia/Kolkata',
};

// Deterministic pseudo-random so the demo data is the same on every run.
const rng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

// Typical glucose pattern through the day (mg/dl) plus daily noise.
const BASE = { morning: 104, after_breakfast: 156, after_lunch: 148, after_dinner: 138 };
const NOTES = ['Felt a bit dizzy', 'Skipped the morning walk', 'Birthday dinner', 'Slept badly', 'Long meeting, ate late', 'Back to routine'];

export async function seed({ days = 75 } = {}) {
  await migrate();
  const rand = rng(42);
  const hash = await bcrypt.hash(DEMO.patient.password, 10);

  const upsertUser = async (u, role, extra = {}) =>
    (await pool.query(
      `INSERT INTO users (name, email, password_hash, role, timezone, email_verified_at, doctor_status, license_number)
       VALUES ($1,$2,$3,$4,$5, now(), $6, $7)
       ON CONFLICT (lower(email)) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash,
         timezone = EXCLUDED.timezone, email_verified_at = now(), doctor_status = EXCLUDED.doctor_status, license_number = EXCLUDED.license_number
       RETURNING id`,
      [u.name, u.email, hash, role, DEMO.timezone, extra.status ?? null, u.license ?? null],
    )).rows[0].id;

  const patientId = await upsertUser(DEMO.patient, 'patient');
  const doctorId = await upsertUser(DEMO.doctor, 'doctor', { status: 'verified' });
  await upsertUser(DEMO.pendingDoctor, 'doctor', { status: 'pending' });
  await pool.query('INSERT INTO doctor_patients (doctor_id, patient_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [doctorId, patientId]);
  await pool.query('DELETE FROM readings WHERE user_id = $1', [patientId]);
  await pool.query('DELETE FROM doctor_comments WHERE patient_id = $1', [patientId]);
  await pool.query('UPDATE users SET last_reminded_date = NULL WHERE id = $1', [patientId]);

  const end = today(DEMO.timezone);
  let inserted = 0;
  for (let i = days; i >= 0; i--) {
    const date = addDays(end, -i);
    // Today is left partly empty so the demo shows an incomplete day; other days vary 2-4 readings.
    const count = i === 0 ? 2 : rand() < 0.1 ? 0 : rand() < 0.7 ? 4 : 3;
    for (const slot of SLOT_KEYS.slice(0, count)) {
      const value = Math.min(600, Math.max(40, Math.round(BASE[slot] + (rand() - 0.45) * 70)));
      const tags = [];
      if (slot === 'after_dinner' && rand() < 0.25) tags.push('big_meal');
      if (slot === 'morning' && rand() < 0.2) tags.push('exercise');
      if (rand() < 0.06) tags.push('poor_sleep');
      const notes = rand() < 0.12 ? NOTES[Math.floor(rand() * NOTES.length)] : null;
      await pool.query(
        'INSERT INTO readings (user_id, reading_date, slot, value, notes, tags) VALUES ($1,$2,$3,$4,$5,$6)',
        [patientId, date, slot, value, notes, tags],
      );
      inserted++;
    }
  }

  await pool.query(
    'INSERT INTO doctor_comments (doctor_id, patient_id, comment_date, body) VALUES ($1,$2,$3,$4), ($1,$2,$5,$6)',
    [doctorId, patientId, addDays(end, -1), 'Evening values look better this week. Keep the post-dinner walk going.',
      addDays(end, -6), 'Fasting readings are drifting up on the days you sleep badly. Let\'s review at the next visit.'],
  );
  return { patientId, doctorId, inserted };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed()
    .then(({ inserted }) => {
      console.log(`Seeded ${inserted} readings.`);
      console.log(`  Patient:         ${DEMO.patient.email} / ${DEMO.patient.password}`);
      console.log(`  Doctor:          ${DEMO.doctor.email} / ${DEMO.doctor.password}`);
      console.log(`  Pending doctor:  ${DEMO.pendingDoctor.email} / ${DEMO.pendingDoctor.password}  (approve with: npm --prefix server run verify-doctor -- ${DEMO.pendingDoctor.email})`);
    })
    .catch((err) => {
      console.error('Seed failed:', err.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
