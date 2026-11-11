import crypto from 'node:crypto';
import { query } from '../db/pool.js';

const hash = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

/** Create a single-use token. Only its hash is stored; the raw value goes into the emailed link. */
export async function createToken(userId, kind, ttlMs) {
  const raw = crypto.randomBytes(32).toString('hex');
  await query(
    `INSERT INTO auth_tokens (user_id, kind, token_hash, expires_at) VALUES ($1,$2,$3, now() + ($4 || ' milliseconds')::interval)`,
    [userId, kind, hash(raw), String(ttlMs)],
  );
  return raw;
}

/** Atomically consume a token; returns the user id, or null if unknown / used / expired. */
export async function consumeToken(raw, kind) {
  if (typeof raw !== 'string' || raw.length < 20) return null;
  const { rows } = await query(
    `UPDATE auth_tokens SET used_at = now()
     WHERE token_hash = $1 AND kind = $2 AND used_at IS NULL AND expires_at > now() RETURNING user_id`,
    [hash(raw), kind],
  );
  return rows[0]?.user_id ?? null;
}

export const HOUR = 3600_000;
