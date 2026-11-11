import { Router } from 'express';
import { query } from '../db/pool.js';
import { config } from '../config.js';
import { asyncHandler, parse } from '../middleware/error.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { settingsSchema, emailSchema, pushSubscriptionSchema } from '../lib/validation.js';
import { badRequest, notFound, forbidden } from '../lib/errors.js';
import { invalidateReports } from '../lib/cache.js';
import { pushEnabled } from '../lib/push.js';
import { presentUser, getUser } from '../services/users.js';
import { recentComments } from '../services/comments.js';

const router = Router();
router.use(['/me', '/push'], requireAuth);

// ---- Settings: timezone, target ranges, reminders ----
router.patch('/me/settings', asyncHandler(async (req, res) => {
  const patch = parse(settingsSchema, req.body);
  const u = req.user;
  const merged = {
    fastingLow: patch.fastingLow ?? u.fasting_low,
    fastingHigh: patch.fastingHigh ?? u.fasting_high,
    postLow: patch.postLow ?? u.post_low,
    postHigh: patch.postHigh ?? u.post_high,
  };
  if (merged.fastingLow >= merged.fastingHigh) throw badRequest('Fasting low must be below fasting high.', { field: 'fastingLow' });
  if (merged.postLow >= merged.postHigh) throw badRequest('After-meal low must be below after-meal high.', { field: 'postLow' });

  const next = {
    name: patch.name ?? u.name,
    timezone: patch.timezone ?? u.timezone,
    reminder_enabled: patch.reminderEnabled ?? u.reminder_enabled,
    reminder_time: patch.reminderTime ?? u.reminder_time,
    reminder_email: patch.reminderEmail ?? u.reminder_email,
    reminder_push: patch.reminderPush ?? u.reminder_push,
  };
  await query(
    `UPDATE users SET name=$1, timezone=$2, fasting_low=$3, fasting_high=$4, post_low=$5, post_high=$6,
       reminder_enabled=$7, reminder_time=$8, reminder_email=$9, reminder_push=$10, last_reminded_date=NULL WHERE id=$11`,
    [next.name, next.timezone, merged.fastingLow, merged.fastingHigh, merged.postLow, merged.postHigh,
      next.reminder_enabled, next.reminder_time, next.reminder_email, next.reminder_push, u.id],
  );
  await invalidateReports(u.id); // reports embed the user's targets
  res.json({ user: presentUser(await getUser(u.id)) });
}));

// ---- Care team: a patient chooses which verified doctors can see their data ----
router.get('/me/doctors', requireRole('patient'), asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.name, u.email FROM doctor_patients dp JOIN users u ON u.id = dp.doctor_id
     WHERE dp.patient_id = $1 ORDER BY u.name`,
    [req.user.id],
  );
  res.json({ data: rows });
}));

router.post('/me/doctors', requireRole('patient'), asyncHandler(async (req, res) => {
  const { email } = parse(emailSchema, req.body);
  const { rows } = await query(`SELECT id, name, email, doctor_status FROM users WHERE lower(email) = $1 AND role = 'doctor'`, [email]);
  if (!rows[0]) throw notFound('No doctor account found with that email.');
  if (rows[0].doctor_status !== 'verified') throw forbidden('This doctor account is still pending verification, so it can\'t receive your readings yet.');
  await query('INSERT INTO doctor_patients (doctor_id, patient_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [rows[0].id, req.user.id]);
  const { doctor_status, ...doctor } = rows[0];
  res.status(201).json({ doctor });
}));

router.delete('/me/doctors/:id', requireRole('patient'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw badRequest('Invalid doctor id.');
  await query('DELETE FROM doctor_patients WHERE doctor_id = $1 AND patient_id = $2', [id, req.user.id]);
  res.status(204).end();
}));

// Comments doctors have left for this patient.
router.get('/me/comments', requireRole('patient'), asyncHandler(async (req, res) => {
  res.json({ data: await recentComments(req.user.id, { limit: Math.min(Number(req.query.limit) || 10, 50) }) });
}));

// ---- Web push ----
router.get('/push/public-key', (_req, res) => res.json({ enabled: pushEnabled, publicKey: pushEnabled ? config.vapidPublicKey : null }));

router.post('/push/subscribe', asyncHandler(async (req, res) => {
  if (!pushEnabled) throw badRequest('Push notifications are not configured on this server.');
  const { endpoint, keys } = parse(pushSubscriptionSchema, req.body);
  await query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1,$2,$3,$4)
     ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
    [req.user.id, endpoint, keys.p256dh, keys.auth],
  );
  res.status(201).json({ ok: true });
}));

router.post('/push/unsubscribe', asyncHandler(async (req, res) => {
  const endpoint = String(req.body?.endpoint || '');
  await query('DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2', [req.user.id, endpoint]);
  res.status(204).end();
}));

export default router;
