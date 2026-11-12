import { query } from '../db/pool.js';
import { presentUser } from './users.js';

/**
 * Everything Sweety stores about one user, as a plain object (never password hashes or tokens).
 * Patients get their readings and the doctors/comments linked to them; doctors get their patients
 * and the comments they wrote.
 */
export async function exportUserData(user) {
  const out = { exportedAt: new Date().toISOString(), profile: presentUser(user) };

  if (user.role === 'patient') {
    out.readings = (await query(
      `SELECT reading_date AS date, slot, value, notes, tags, created_at, updated_at
       FROM readings WHERE user_id = $1 ORDER BY reading_date, created_at`,
      [user.id],
    )).rows;
    out.sharedWith = (await query(
      `SELECT u.name, u.email, dp.created_at AS shared_since FROM doctor_patients dp
       JOIN users u ON u.id = dp.doctor_id WHERE dp.patient_id = $1 ORDER BY u.name`,
      [user.id],
    )).rows;
    out.doctorComments = (await query(
      `SELECT c.comment_date AS date, c.body, c.created_at, u.name AS doctor
       FROM doctor_comments c JOIN users u ON u.id = c.doctor_id WHERE c.patient_id = $1 ORDER BY c.comment_date, c.created_at`,
      [user.id],
    )).rows;
  } else {
    out.patients = (await query(
      `SELECT u.name, u.email, dp.created_at AS shared_since FROM doctor_patients dp
       JOIN users u ON u.id = dp.patient_id WHERE dp.doctor_id = $1 ORDER BY u.name`,
      [user.id],
    )).rows;
    out.commentsWritten = (await query(
      `SELECT c.comment_date AS date, c.body, c.created_at, u.name AS patient
       FROM doctor_comments c JOIN users u ON u.id = c.patient_id WHERE c.doctor_id = $1 ORDER BY c.comment_date, c.created_at`,
      [user.id],
    )).rows;
  }
  return out;
}
