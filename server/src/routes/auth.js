import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/pool.js';
import { asyncHandler, parse } from '../middleware/error.js';
import { signToken, requireAuth, requireRole } from '../middleware/auth.js';
import { signupSchema, loginSchema, emailSchema } from '../lib/validation.js';
import { conflict, unauthorized, notFound, badRequest } from '../lib/errors.js';

const router = Router();

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });

router.post('/auth/signup', asyncHandler(async (req, res) => {
  const { name, email, password, role } = parse(signupSchema, req.body);
  const hash = await bcrypt.hash(password, 10);
  try {
    const { rows } = await query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id, name, email, role',
      [name, email, hash, role],
    );
    res.status(201).json({ user: publicUser(rows[0]), token: signToken(rows[0]) });
  } catch (err) {
    if (err.code === '23505') throw conflict('An account with this email already exists.', { field: 'email', code: 'EMAIL_TAKEN' });
    throw err;
  }
}));

router.post('/auth/login', asyncHandler(async (req, res) => {
  const { email, password } = parse(loginSchema, req.body);
  const { rows } = await query('SELECT * FROM users WHERE lower(email) = $1', [email]);
  const user = rows[0];
  // Same message for unknown email and wrong password (no account enumeration).
  const ok = user && (await bcrypt.compare(password, user.password_hash));
  if (!ok) throw unauthorized('Incorrect email or password.');
  res.json({ user: publicUser(user), token: signToken(user) });
}));

router.get('/auth/me', requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT id, name, email, role FROM users WHERE id = $1', [req.user.id]);
  if (!rows[0]) throw unauthorized();
  res.json({ user: publicUser(rows[0]) });
}));

// ---- Care team: a patient chooses which doctors can see their data ----
router.get('/me/doctors', requireAuth, requireRole('patient'), asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.name, u.email FROM doctor_patients dp JOIN users u ON u.id = dp.doctor_id
     WHERE dp.patient_id = $1 ORDER BY u.name`,
    [req.user.id],
  );
  res.json({ data: rows });
}));

router.post('/me/doctors', requireAuth, requireRole('patient'), asyncHandler(async (req, res) => {
  const { email } = parse(emailSchema, req.body);
  const { rows } = await query(`SELECT id, name, email FROM users WHERE lower(email) = $1 AND role = 'doctor'`, [email]);
  if (!rows[0]) throw notFound('No doctor account found with that email.');
  await query('INSERT INTO doctor_patients (doctor_id, patient_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [rows[0].id, req.user.id]);
  res.status(201).json({ doctor: rows[0] });
}));

router.delete('/me/doctors/:id', requireAuth, requireRole('patient'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw badRequest('Invalid doctor id.');
  await query('DELETE FROM doctor_patients WHERE doctor_id = $1 AND patient_id = $2', [id, req.user.id]);
  res.status(204).end();
}));

export default router;
