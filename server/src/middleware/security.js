import { config } from '../config.js';
import { forbidden } from '../lib/errors.js';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

export const allowedOrigins = () => config.clientOrigin.split(',').map((o) => o.trim().replace(/\/+$/, ''));

/**
 * CSRF defence for cookie sessions, layered on top of SameSite=Lax:
 *  - a state-changing request that carries an Origin header must come from our own web app;
 *  - bodies must be JSON (a cross-site <form> cannot send application/json without a CORS preflight).
 * Requests with no Origin (curl, server-to-server, same-site navigations) are not browsers attacking
 * a signed-in user, so they pass; they still need a valid credential.
 */
export function csrfGuard(req, _res, next) {
  if (SAFE.has(req.method)) return next();
  const origin = req.headers.origin;
  if (origin && !allowedOrigins().includes(origin.replace(/\/+$/, ''))) {
    return next(forbidden('This request came from an untrusted origin.'));
  }
  const hasBody = Number(req.headers['content-length'] || 0) > 0;
  if (hasBody && !req.is('application/json')) return next(forbidden('Requests must be sent as JSON.'));
  next();
}

/** Personal health data must never be stored by browsers or shared caches. */
export function noStore(_req, res, next) {
  res.setHeader('Cache-Control', 'no-store');
  next();
}
