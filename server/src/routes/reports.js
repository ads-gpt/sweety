import { Router } from 'express';
import { query } from '../db/pool.js';
import { asyncHandler, parse } from '../middleware/error.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { reportQuerySchema, reportTypeSchema } from '../lib/validation.js';
import { today } from '../lib/dates.js';
import { forbidden, badRequest } from '../lib/errors.js';
import { buildReport } from '../services/reports.js';
import { listReadings } from '../services/readings.js';

const router = Router();
router.use(['/reports', '/doctor'], requireAuth);

/** Patients see their own data; doctors may pass ?patientId= for patients who shared with them. */
async function resolveSubject(req, patientId) {
  if (req.user.role === 'patient') {
    if (patientId && patientId !== req.user.id) throw forbidden();
    return req.user.id;
  }
  if (!patientId) throw badRequest('patientId is required for doctors.');
  const { rowCount } = await query('SELECT 1 FROM doctor_patients WHERE doctor_id = $1 AND patient_id = $2', [req.user.id, patientId]);
  if (!rowCount) throw forbidden('This patient has not shared their readings with you.');
  return patientId;
}

router.get('/reports/:type', asyncHandler(async (req, res) => {
  const type = parse(reportTypeSchema, req.params.type);
  const { date = today(), patientId } = parse(reportQuerySchema, req.query);
  const subject = await resolveSubject(req, patientId);
  res.json(await buildReport(subject, type, date));
}));

// Doctor view: list of patients + a patient's raw readings (paginated).
router.get('/doctor/patients', requireRole('doctor'), asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.name, u.email,
            (SELECT MAX(reading_date) FROM readings r WHERE r.user_id = u.id) AS last_reading_date,
            (SELECT COUNT(*)::int FROM readings r WHERE r.user_id = u.id AND r.reading_date >= $2) AS readings_last_30_days
     FROM doctor_patients dp JOIN users u ON u.id = dp.patient_id
     WHERE dp.doctor_id = $1 ORDER BY u.name`,
    [req.user.id, new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)],
  );
  res.json({ data: rows.map((r) => ({ id: r.id, name: r.name, email: r.email, lastReadingDate: r.last_reading_date, readingsLast30Days: r.readings_last_30_days })) });
}));

router.get('/doctor/patients/:id/readings', requireRole('doctor'), asyncHandler(async (req, res) => {
  const patientId = Number(req.params.id);
  const subject = await resolveSubject(req, patientId);
  res.json(await listReadings(subject, { page: Number(req.query.page) || 1, limit: Math.min(Number(req.query.limit) || 20, 100) }));
}));

export default router;
