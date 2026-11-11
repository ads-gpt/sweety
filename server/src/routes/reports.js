import { Router } from 'express';
import { query } from '../db/pool.js';
import { asyncHandler, parse } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import { makeReportQuerySchema, reportTypeSchema } from '../lib/validation.js';
import { today } from '../lib/dates.js';
import { forbidden, badRequest } from '../lib/errors.js';
import { buildReport } from '../services/reports.js';
import { getUser } from '../services/users.js';

const router = Router();
router.use('/reports', requireAuth);

/**
 * Patients see their own data; verified doctors may pass ?patientId= for patients
 * who shared with them. Returns the patient's user row (targets are theirs, not the doctor's).
 */
async function resolveSubject(req, patientId) {
  if (req.user.role === 'patient') {
    if (patientId && patientId !== req.user.id) throw forbidden();
    return req.user;
  }
  if (req.user.doctor_status !== 'verified') throw forbidden('Your doctor account is pending verification.');
  if (!patientId) throw badRequest('patientId is required for doctors.');
  const { rowCount } = await query('SELECT 1 FROM doctor_patients WHERE doctor_id = $1 AND patient_id = $2', [req.user.id, patientId]);
  if (!rowCount) throw forbidden('This patient has not shared their readings with you.');
  return getUser(patientId);
}

router.get('/reports/:type', asyncHandler(async (req, res) => {
  const type = parse(reportTypeSchema, req.params.type);
  // "Today" and the future-date rule follow the signed-in user's own timezone.
  const { date = today(req.user.timezone), patientId } = parse(makeReportQuerySchema(req.user.timezone), req.query);
  const subject = await resolveSubject(req, patientId);
  res.json(await buildReport(subject, type, date));
}));

export default router;
