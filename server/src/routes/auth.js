import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/pool.js';
import { config } from '../config.js';
import { asyncHandler, parse } from '../middleware/error.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { signupSchema, loginSchema, forgotSchema, resetSchema, tokenSchema, changePasswordSchema } from '../lib/validation.js';
import { conflict, unauthorized, badRequest } from '../lib/errors.js';
import { createToken, consumeToken, HOUR } from '../lib/tokens.js';
import { trySendMail } from '../lib/mailer.js';
import { verifyEmail, resetPasswordEmail } from '../lib/emails.js';
import { getUser, presentUser, USER_COLS } from '../services/users.js';

const router = Router();

async function sendVerificationEmail(user) {
  const token = await createToken(user.id, 'verify', 24 * HOUR);
  await trySendMail({ to: user.email, ...verifyEmail({ name: user.name, url: `${config.appUrl}/verify-email?token=${token}` }) });
}

router.post('/auth/signup', asyncHandler(async (req, res) => {
  const { name, email, password, role, timezone, licenseNumber } = parse(signupSchema, req.body);
  const hash = await bcrypt.hash(password, 10);
  try {
    const { rows } = await query(
      `INSERT INTO users (name, email, password_hash, role, timezone, license_number, doctor_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING ${USER_COLS}`,
      [name, email, hash, role, timezone ?? config.defaultTimezone, role === 'doctor' ? licenseNumber : null, role === 'doctor' ? 'pending' : null],
    );
    // Awaited so the email is queued before we respond; a mail failure is logged, never thrown.
    await sendVerificationEmail(rows[0]).catch((e) => console.error('[mail] verification failed:', e.message));
    res.status(201).json({ user: presentUser(rows[0]), token: signToken(rows[0]) });
  } catch (err) {
    if (err.code === '23505') throw conflict('An account with this email already exists.', { field: 'email', code: 'EMAIL_TAKEN' });
    throw err;
  }
}));

router.post('/auth/login', asyncHandler(async (req, res) => {
  const { email, password } = parse(loginSchema, req.body);
  const { rows } = await query('SELECT id, password_hash FROM users WHERE lower(email) = $1', [email]);
  // Same message for unknown email and wrong password (no account enumeration).
  const ok = rows[0] && (await bcrypt.compare(password, rows[0].password_hash));
  if (!ok) throw unauthorized('Incorrect email or password.');
  const user = await getUser(rows[0].id);
  res.json({ user: presentUser(user), token: signToken(user) });
}));

router.get('/auth/me', requireAuth, (req, res) => res.json({ user: presentUser(req.user) }));

// ---- Email verification ----
router.post('/auth/verify-email', asyncHandler(async (req, res) => {
  const { token } = parse(tokenSchema, req.body);
  const userId = await consumeToken(token, 'verify');
  if (!userId) throw badRequest('This verification link is invalid or has expired.', { code: 'BAD_TOKEN' });
  await query('UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1', [userId]);
  res.json({ ok: true });
}));

router.post('/auth/resend-verification', requireAuth, asyncHandler(async (req, res) => {
  if (req.user.email_verified_at) return res.json({ ok: true, alreadyVerified: true });
  await sendVerificationEmail(req.user);
  res.json({ ok: true });
}));

// ---- Password reset ----
router.post('/auth/forgot-password', asyncHandler(async (req, res) => {
  const { email } = parse(forgotSchema, req.body);
  const { rows } = await query('SELECT id, name, email FROM users WHERE lower(email) = $1', [email]);
  if (rows[0]) {
    const token = await createToken(rows[0].id, 'reset', HOUR);
    await trySendMail({ to: rows[0].email, ...resetPasswordEmail({ name: rows[0].name, url: `${config.appUrl}/reset-password?token=${token}` }) });
  }
  // Always the same answer so the endpoint can't be used to discover which emails have accounts.
  res.json({ ok: true });
}));

router.post('/auth/reset-password', asyncHandler(async (req, res) => {
  const { token, password } = parse(resetSchema, req.body);
  const userId = await consumeToken(token, 'reset');
  if (!userId) throw badRequest('This reset link is invalid or has expired.', { code: 'BAD_TOKEN' });
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [await bcrypt.hash(password, 10), userId]);
  // Whoever held the reset email owns the inbox, so also treat the address as verified.
  await query('UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1', [userId]);
  res.json({ ok: true });
}));

router.post('/auth/change-password', requireAuth, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = parse(changePasswordSchema, req.body);
  const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
  if (!(await bcrypt.compare(currentPassword, rows[0].password_hash))) {
    throw badRequest('Your current password is incorrect.', { field: 'currentPassword' });
  }
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [await bcrypt.hash(newPassword, 10), req.user.id]);
  res.json({ ok: true });
}));

export default router;
