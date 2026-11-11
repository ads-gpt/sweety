import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { unauthorized, forbidden } from '../lib/errors.js';
import { getUser } from '../services/users.js';

export const signToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

/** Verifies the JWT and loads the current user row (so timezone / targets are always fresh). */
export async function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(unauthorized());
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    return next(unauthorized('Your session has expired. Please sign in again.'));
  }
  try {
    const row = await getUser(Number(payload.sub));
    if (!row) return next(unauthorized());
    req.user = { ...row, id: row.id, role: row.role };
    next();
  } catch (err) {
    next(err);
  }
}

export const requireRole = (role) => (req, _res, next) =>
  req.user?.role === role ? next() : next(forbidden(`Only ${role}s can do this.`));

/** Doctors can see patient data only after an admin has verified their registration. */
export const requireVerifiedDoctor = (req, _res, next) =>
  req.user?.role === 'doctor' && req.user.doctor_status === 'verified'
    ? next()
    : next(forbidden('Your doctor account is pending verification.'));
