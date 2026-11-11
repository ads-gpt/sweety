// Admin tool: approve (or reject) a doctor's registration.
//   npm --prefix server run verify-doctor -- doctor@clinic.com           -> verified
//   npm --prefix server run verify-doctor -- doctor@clinic.com --reject  -> rejected
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';
import { trySendMail } from '../lib/mailer.js';

export async function setDoctorStatus(email, status) {
  const { rows } = await pool.query(
    `UPDATE users SET doctor_status = $2 WHERE lower(email) = lower($1) AND role = 'doctor' RETURNING id, name, email, license_number`,
    [email, status],
  );
  if (rows[0]) {
    await trySendMail({
      to: rows[0].email,
      subject: status === 'verified' ? 'Your Sweety doctor account is verified' : 'Your Sweety doctor registration was not approved',
      text: status === 'verified'
        ? `Hi ${rows[0].name},\n\nYour registration (${rows[0].license_number}) has been verified. Patients can now share their readings with you.`
        : `Hi ${rows[0].name},\n\nWe could not verify your registration (${rows[0].license_number}).`,
    });
  }
  return rows[0] ?? null;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [email, flag] = process.argv.slice(2);
  if (!email) {
    console.error('Usage: npm --prefix server run verify-doctor -- <email> [--reject]');
    process.exit(1);
  }
  setDoctorStatus(email, flag === '--reject' ? 'rejected' : 'verified')
    .then((d) => (d ? console.log(`${d.name} <${d.email}> (${d.license_number}) is now ${flag === '--reject' ? 'rejected' : 'verified'}.`) : (console.error('No doctor with that email.'), (process.exitCode = 1))))
    .finally(() => pool.end());
}
