import { Router } from 'express';
import { asyncHandler, parse } from '../middleware/error.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { makeReadingSchema, listQuerySchema } from '../lib/validation.js';
import { badRequest } from '../lib/errors.js';
import { SLOT_KEYS } from '../lib/slots.js';
import { targetsOf, statusOf } from '../lib/targets.js';
import { glucoseAlert } from '../lib/alerts.js';
import * as readings from '../services/readings.js';

const router = Router();
router.use('/readings', requireAuth, requireRole('patient'));

const idParam = (req) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw badRequest('Invalid reading id.');
  return id;
};

const csvCell = (v) => {
  let s = String(v ?? '');
  // Neutralise spreadsheet formula injection (=, +, -, @ at the start of a cell).
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

router.get('/readings', asyncHandler(async (req, res) => {
  const q = parse(listQuerySchema, req.query);
  res.json(await readings.listReadings(req.user.id, q));
}));

// Must come before /readings/:id
router.get('/readings/export.csv', asyncHandler(async (req, res) => {
  const { from, to, tag, q } = parse(listQuerySchema, req.query);
  const targets = targetsOf(req.user);
  // A page is capped at 100 rows; walk every page so the export is complete.
  const first = await readings.listReadings(req.user.id, { page: 1, limit: 100, from, to, tag, q });
  let all = first.data;
  for (let p = 2; p <= first.pagination.totalPages; p++) {
    all = all.concat((await readings.listReadings(req.user.id, { page: p, limit: 100, from, to, tag, q })).data);
  }
  const lines = ['date,slot,value_mg_dl,status,tags,notes'];
  // Oldest first, and within a day in slot order (morning -> dinner).
  const rank = (s) => SLOT_KEYS.indexOf(s);
  all.sort((a, b) => a.date.localeCompare(b.date) || rank(a.slot) - rank(b.slot));
  for (const r of all) {
    lines.push([r.date, r.slotLabel, r.value, statusOf(r.value, r.slot, targets), (r.tags || []).join(' '), r.notes].map(csvCell).join(','));
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="sweety-readings.csv"');
  res.send(lines.join('\n') + '\n');
}));

router.get('/readings/:id', asyncHandler(async (req, res) => {
  res.json({ reading: await readings.getReading(req.user.id, idParam(req)) });
}));

router.post('/readings', asyncHandler(async (req, res) => {
  const body = parse(makeReadingSchema(req.user.timezone), req.body);
  const reading = await readings.createReading(req.user.id, body);
  res.status(201).json({ reading, alert: glucoseAlert(reading.value, reading.slot, targetsOf(req.user)) });
}));

router.put('/readings/:id', asyncHandler(async (req, res) => {
  const id = idParam(req);
  const body = parse(makeReadingSchema(req.user.timezone), req.body);
  const reading = await readings.updateReading(req.user.id, id, body);
  res.json({ reading, alert: glucoseAlert(reading.value, reading.slot, targetsOf(req.user)) });
}));

router.delete('/readings/:id', asyncHandler(async (req, res) => {
  await readings.deleteReading(req.user.id, idParam(req));
  res.status(204).end();
}));

export default router;
