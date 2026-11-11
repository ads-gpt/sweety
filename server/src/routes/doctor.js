import { Router } from 'express';
import { query } from '../db/pool.js';
import { asyncHandler, parse } from '../middleware/error.js';
import { requireAuth, requireRole, requireVerifiedDoctor } from '../middleware/auth.js';
import { commentSchema } from '../lib/validation.js';
import { forbidden, badRequest } from '../lib/errors.js';
import { today } from '../lib/dates.js';
import { trySendMail } from '../lib/mailer.js';
import { config } from '../config.js';
import { listReadings } from '../services/readings.js';
import { getUser } from '../services/users.js';
import { addComment, deleteComment, recentComments } from '../services/comments.js';
import { sendPush } from '../lib/push.js';

const router = Router();
router.use('/doctor', requireAuth, requireRole('doctor'), requireVerifiedDoctor);

async function assertShared(doctorId, patientId) {
  if (!Number.isInteger(patientId) || patientId < 1) throw badRequest('Invalid patient id.');
  const { rowCount } = await query('SELECT 1 FROM doctor_patients WHERE doctor_id = $1 AND patient_id = $2', [doctorId, patientId]);
  if (!rowCount) throw forbidden('This patient has not shared their readings with you.');
}

router.get('/doctor/patients', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.name, u.email,
            (SELECT MAX(reading_date) FROM readings r WHERE r.user_id = u.id) AS last_reading_date,
            (SELECT COUNT(*)::int FROM readings r WHERE r.user_id = u.id AND r.reading_date >= (now() AT TIME ZONE u.timezone)::date - 30) AS readings_last_30_days
     FROM doctor_patients dp JOIN users u ON u.id = dp.patient_id
     WHERE dp.doctor_id = $1 ORDER BY u.name`,
    [req.user.id],
  );
  res.json({ data: rows.map((r) => ({ id: r.id, name: r.name, email: r.email, lastReadingDate: r.last_reading_date, readingsLast30Days: r.readings_last_30_days })) });
}));

router.get('/doctor/patients/:id/readings', asyncHandler(async (req, res) => {
  const patientId = Number(req.params.id);
  await assertShared(req.user.id, patientId);
  res.json(await listReadings(patientId, { page: Number(req.query.page) || 1, limit: Math.min(Number(req.query.limit) || 20, 100) }));
}));

router.get('/doctor/patients/:id/comments', asyncHandler(async (req, res) => {
  const patientId = Number(req.params.id);
  await assertShared(req.user.id, patientId);
  res.json({ data: await recentComments(patientId, { limit: 50 }) });
}));

router.post('/doctor/patients/:id/comments', asyncHandler(async (req, res) => {
  const patientId = Number(req.params.id);
  await assertShared(req.user.id, patientId);
  const patient = await getUser(patientId);
  const body = parse(commentSchema, req.body);
  if (body.date > today(patient.timezone)) throw badRequest('Date cannot be in the future.', { field: 'date' });
  const comment = await addComment(req.user.id, patientId, body);

  // Let the patient know (best effort; never blocks the response).
  trySendMail({
    to: patient.email,
    subject: `${req.user.name} left a comment on your readings`,
    text: `Hi ${patient.name},\n\n${req.user.name} commented on ${body.date}:\n\n"${body.body}"\n\nOpen Sweety to see it: ${config.appUrl}`,
  });
  sendPush(patientId, { title: `${req.user.name} commented on your readings`, body: body.body.slice(0, 120), url: '/' }).catch(() => {});

  res.status(201).json({ comment });
}));

router.delete('/doctor/comments/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw badRequest('Invalid comment id.');
  await deleteComment(req.user.id, id);
  res.status(204).end();
}));

export default router;
