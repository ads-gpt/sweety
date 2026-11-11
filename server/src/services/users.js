import { query } from '../db/pool.js';
import { targetsOf } from '../lib/targets.js';

export const USER_COLS = `id, name, email, role, timezone, fasting_low, fasting_high, post_low, post_high,
  email_verified_at, doctor_status, license_number, reminder_enabled, reminder_time, reminder_email, reminder_push`;

/** What the client is allowed to see about a user (never the password hash). */
export const presentUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  timezone: u.timezone,
  emailVerified: Boolean(u.email_verified_at),
  doctorStatus: u.role === 'doctor' ? u.doctor_status : null,
  licenseNumber: u.role === 'doctor' ? u.license_number : null,
  settings: {
    ...targetsOf(u),
    reminderEnabled: u.reminder_enabled,
    reminderTime: u.reminder_time,
    reminderEmail: u.reminder_email,
    reminderPush: u.reminder_push,
  },
});

export const getUser = async (id) => (await query(`SELECT ${USER_COLS} FROM users WHERE id = $1`, [id])).rows[0] ?? null;
