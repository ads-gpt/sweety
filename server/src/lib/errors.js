export class HttpError extends Error {
  constructor(status, message, { field, code } = {}) {
    super(message);
    this.status = status;
    this.field = field;
    this.code = code;
  }
}

export const badRequest = (message, opts) => new HttpError(400, message, opts);
export const unauthorized = (message = 'Please sign in to continue.') => new HttpError(401, message);
export const forbidden = (message = 'You do not have access to this resource.') => new HttpError(403, message);
export const notFound = (message = 'Not found.') => new HttpError(404, message);
export const conflict = (message, opts) => new HttpError(409, message, opts);
export const tooManyRequests = (message, opts) => new HttpError(429, message, { code: 'LOCKED', ...opts });
