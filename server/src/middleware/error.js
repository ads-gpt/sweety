import { ZodError } from 'zod';
import { HttpError } from '../lib/errors.js';

/** Parse request data with a zod schema; the first issue becomes a 400 with a clear message. */
export function parse(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  throw zodToHttp(result.error);
}

function zodToHttp(err) {
  const issue = err.issues[0];
  return new HttpError(400, issue.message, { field: issue.path[0], code: 'VALIDATION' });
}

export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function notFoundHandler(_req, _res, next) {
  next(new HttpError(404, 'Route not found.'));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError) err = zodToHttp(err);
  if (err.type === 'entity.parse.failed') err = new HttpError(400, 'Invalid JSON body.');
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { message: err.message, field: err.field, code: err.code } });
  }
  // Safety net: unique violation from a concurrent duplicate slot insert/update.
  if (err.code === '23505' && err.constraint?.includes('user_id_reading_date_slot')) {
    return res.status(409).json({ error: { message: 'You already have a reading for that slot on this date.', field: 'slot', code: 'DUPLICATE_SLOT' } });
  }
  if (err.code === '23505' && err.constraint?.includes('email')) {
    return res.status(409).json({ error: { message: 'An account with this email already exists.', field: 'email', code: 'EMAIL_TAKEN' } });
  }
  console.error(err);
  res.status(500).json({ error: { message: 'Something went wrong on our side. Please try again.' } });
}
