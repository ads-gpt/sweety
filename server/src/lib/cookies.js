import { config } from '../config.js';

/** Minimal Cookie-header parser (we only ever read one cookie, so no extra dependency). */
export function readCookie(req, name = config.cookieName) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) {
      try { return decodeURIComponent(part.slice(i + 1).trim()); } catch { return null; }
    }
  }
  return null;
}

/**
 * The session cookie is httpOnly (not readable by page JavaScript), SameSite=Lax (not sent on
 * cross-site POSTs) and Secure in production.
 */
const base = () => ({ httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, path: '/' });

export const setSessionCookie = (res, token) => res.cookie(config.cookieName, token, { ...base(), maxAge: config.cookieMaxAgeMs });
export const clearSessionCookie = (res) => res.clearCookie(config.cookieName, base());
