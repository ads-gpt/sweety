import { Router } from 'express';
import { asyncHandler, parse } from '../middleware/error.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { readingSchema, listQuerySchema } from '../lib/validation.js';
import { badRequest } from '../lib/errors.js';
import * as readings from '../services/readings.js';

const router = Router();
router.use('/readings', requireAuth, requireRole('patient'));

const idParam = (req) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw badRequest('Invalid reading id.');
  return id;
};

router.get('/readings', asyncHandler(async (req, res) => {
  const q = parse(listQuerySchema, req.query);
  res.json(await readings.listReadings(req.user.id, q));
}));

router.get('/readings/:id', asyncHandler(async (req, res) => {
  res.json({ reading: await readings.getReading(req.user.id, idParam(req)) });
}));

router.post('/readings', asyncHandler(async (req, res) => {
  const body = parse(readingSchema, req.body);
  res.status(201).json({ reading: await readings.createReading(req.user.id, body) });
}));

router.put('/readings/:id', asyncHandler(async (req, res) => {
  const id = idParam(req);
  const body = parse(readingSchema, req.body);
  res.json({ reading: await readings.updateReading(req.user.id, id, body) });
}));

router.delete('/readings/:id', asyncHandler(async (req, res) => {
  await readings.deleteReading(req.user.id, idParam(req));
  res.status(204).end();
}));

export default router;
