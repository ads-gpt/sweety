import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/pool.js';
import { config } from '../config.js';
import { asyncHandler, parse } from '../middleware/error.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { signupSchema, loginSchema, forgotSchema, resetSchema, tokenSchema, changePasswordSchema } from '../lib/validation.js';
import { conflict, unauthorized, badRequest, tooManyRequests } from '../lib/errors.js';
import { createToken, consumeToken, HOUR } from '../lib/tokens.js';
import { setSessionCookie, clearSessionCookie } from '../lib/cookies.js';
import { trySendMail } from '../lib/mailer.js';
import { verifyEmail, resetPasswordEmail } from '../lib/emails.js';
import { getUser, presentUser, USER_COLS } from '../services/users.js';

const router = Router();

/** Sign the user in: httpOnly cookie for browsers; the token is also returned for API clients. */
function startSession(res, user, status = 200) {
  const token = signToken(user);
  setSessionCookie(res, token);
  res.status(status).json({ user: presentUser(user), token });
}

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
    await sendVerificationEmail(rows[0]);
    startSession(res, rows[0], 201);
  } catch (err) {
    if (err.code === '23505') throw conflict('An account with this email already exists.', { field: 'email', code: 'EMAIL_TAKEN' });
    throw err;
  }
}));

// Remaining lock time is measured by the database (its own clock), so app/DB clock skew can't distort it.
const lockedMessage = (seconds) => {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `Too many failed sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}, or reset your password.`;
};
const LOCK_SECONDS = 'GREATEST(EXTRACT(EPOCH FROM (locked_until - now())), 0)';

router.post('/auth/login', asyncHandler(async (req, res) => {
  const { email, password } = parse(loginSchema, req.body);
  const { rows } = await query(`SELECT id, password_hash, ${LOCK_SECONDS} AS lock_secs FROM users WHERE lower(email) = $1`, [email]);
  const found = rows[0];

  // A locked account refuses even the correct password until the lock expires (or the password is reset).
  if (found && Number(found.lock_secs) > 0) throw tooManyRequests(lockedMessage(Number(found.lock_secs)));

  const ok = found && (await bcrypt.compare(password, found.password_hash));
  if (!ok) {
    if (found) {
      const { rows: r } = await query(
        `UPDATE users SET
           failed_logins = CASE WHEN failed_logins + 1 >= $2 THEN 0 ELSE failed_logins + 1 END,
           locked_until  = CASE WHEN failed_logins + 1 >= $2 THEN now() + ($3 || ' minutes')::interval ELSE locked_until END
         WHERE id = $1 RETURNING ${LOCK_SECONDS} AS lock_secs`,
        [found.id, config.maxFailedLogins, String(config.lockMinutes)],
      );
      if (Number(r[0].lock_secs) > 0) throw tooManyRequests(lockedMessage(Number(r[0].lock_secs)));
    }
    // Same message for unknown email and wrong password (no account enumeration).
    throw unauthorized('Incorrect email or password.');
  }

  await query('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = $1', [found.id]);
  startSession(res, await getUser(found.id));
}));

router.post('/auth/logout', (_req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

// Revoke every session on every device (including this one).
router.post('/auth/logout-all', requireAuth, asyncHandler(async (req, res) => {
  await query('UPDATE users SET token_version = token_version + 1 WHERE id = $1', [req.user.id]);
  clearSessionCookie(res);
  res.status(204).end();
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
  // New password: sign out every existing session, clear any lockout, and (whoever held the
  // reset email owns the inbox) treat the address as verified.
  await query(
    `UPDATE users SET password_hash = $1, token_version = token_version + 1, failed_logins = 0, locked_until = NULL,
       email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $2`,
    [await bcrypt.hash(password, 10), userId],
  );
  res.json({ ok: true });
}));

router.post('/auth/change-password', requireAuth, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = parse(changePasswordSchema, req.body);
  const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
  if (!(await bcrypt.compare(currentPassword, rows[0].password_hash))) {
    throw badRequest('Your current password is incorrect.', { field: 'currentPassword' });
  }
  // Other devices are signed out; this one gets a fresh session so the user stays signed in.
  await query('UPDATE users SET password_hash = $1, token_version = token_version + 1 WHERE id = $2', [await bcrypt.hash(newPassword, 10), req.user.id]);
  const user = await getUser(req.user.id);
  setSessionCookie(res, signToken(user));
  res.json({ ok: true });
}));

export default router;
