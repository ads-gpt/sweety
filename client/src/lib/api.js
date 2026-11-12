// The login session lives in an httpOnly cookie that the server sets, so no token is kept in
// localStorage (page scripts - and therefore XSS - can never read it). fetch() sends the cookie
// automatically because the app and the API share one origin (Vite proxy in dev, nginx in production).

export class ApiError extends Error {
  constructor(message, { status, field, code } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.field = field;
    this.code = code;
  }
}

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

const NETWORK_MSG = 'Cannot reach the server. Please check your connection and try again.';

function buildUrl(path, params) {
  const qs = params
    ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString()
    : '';
  return `/api${path}${qs}`;
}

// A 401 from these calls is an expected answer ("wrong password", "not signed in yet"), not an expired session.
const QUIET_401 = ['/auth/login', '/auth/me', '/auth/reset', '/auth/forgot', '/auth/verify', '/auth/signup'];

async function raw(method, path, { body, params } = {}) {
  let res;
  try {
    res = await fetch(buildUrl(path, params), {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(NETWORK_MSG);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const e = data.error || {};
    if (res.status === 401 && !QUIET_401.some((p) => path.startsWith(p))) onUnauthorized();
    throw new ApiError(e.message || 'Something went wrong. Please try again.', { status: res.status, field: e.field, code: e.code });
  }
  return res;
}

async function request(method, path, opts) {
  const res = await raw(method, path, opts);
  if (res.status === 204) return null;
  return res.json().catch(() => ({}));
}

/** Fetch a file through the API (so the cookie is sent) and hand it to the browser as a download. */
async function download(path, params, filename) {
  const res = await raw('GET', path, { params });
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  signup: (body) => request('POST', '/auth/signup', { body }),
  login: (body) => request('POST', '/auth/login', { body }),
  logout: () => request('POST', '/auth/logout'),
  logoutAll: () => request('POST', '/auth/logout-all'),
  me: () => request('GET', '/auth/me'),
  verifyEmail: (token) => request('POST', '/auth/verify-email', { body: { token } }),
  resendVerification: () => request('POST', '/auth/resend-verification'),
  forgotPassword: (email) => request('POST', '/auth/forgot-password', { body: { email } }),
  resetPassword: (token, password) => request('POST', '/auth/reset-password', { body: { token, password } }),
  changePassword: (body) => request('POST', '/auth/change-password', { body }),

  updateSettings: (body) => request('PATCH', '/me/settings', { body }),
  exportMyData: () => download('/me/export', undefined, 'sweety-data.json'),
  deleteAccount: (password) => request('DELETE', '/me', { body: { password } }),

  listReadings: (params) => request('GET', '/readings', { params }),
  createReading: (body) => request('POST', '/readings', { body }),
  updateReading: (id, body) => request('PUT', `/readings/${id}`, { body }),
  deleteReading: (id) => request('DELETE', `/readings/${id}`),
  exportCsv: (params) => download('/readings/export.csv', params, 'sweety-readings.csv'),

  report: (type, params) => request('GET', `/reports/${type}`, { params }),

  doctors: () => request('GET', '/me/doctors'),
  addDoctor: (email) => request('POST', '/me/doctors', { body: { email } }),
  removeDoctor: (id) => request('DELETE', `/me/doctors/${id}`),
  myComments: (limit = 5) => request('GET', '/me/comments', { params: { limit } }),

  patients: () => request('GET', '/doctor/patients'),
  addComment: (patientId, body) => request('POST', `/doctor/patients/${patientId}/comments`, { body }),
  deleteComment: (id) => request('DELETE', `/doctor/comments/${id}`),

  pushKey: () => request('GET', '/push/public-key'),
  pushSubscribe: (subscription) => request('POST', '/push/subscribe', { body: subscription }),
  pushUnsubscribe: (endpoint) => request('POST', '/push/unsubscribe', { body: { endpoint } }),
};
