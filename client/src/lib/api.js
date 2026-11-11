const TOKEN_KEY = 'sweety-token';

export const tokenStore = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* ignore */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } },
};

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

async function raw(method, path, { body, params } = {}) {
  const token = tokenStore.get();
  let res;
  try {
    res = await fetch(buildUrl(path, params), {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(NETWORK_MSG);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const e = data.error || {};
    const isAuthCall = path.startsWith('/auth/login') || path.startsWith('/auth/reset') || path.startsWith('/auth/forgot') || path.startsWith('/auth/verify');
    if (res.status === 401 && token && !isAuthCall) onUnauthorized();
    throw new ApiError(e.message || 'Something went wrong. Please try again.', { status: res.status, field: e.field, code: e.code });
  }
  return res;
}

async function request(method, path, opts) {
  const res = await raw(method, path, opts);
  if (res.status === 204) return null;
  return res.json().catch(() => ({}));
}

export const api = {
  signup: (body) => request('POST', '/auth/signup', { body }),
  login: (body) => request('POST', '/auth/login', { body }),
  me: () => request('GET', '/auth/me'),
  verifyEmail: (token) => request('POST', '/auth/verify-email', { body: { token } }),
  resendVerification: () => request('POST', '/auth/resend-verification'),
  forgotPassword: (email) => request('POST', '/auth/forgot-password', { body: { email } }),
  resetPassword: (token, password) => request('POST', '/auth/reset-password', { body: { token, password } }),
  changePassword: (body) => request('POST', '/auth/change-password', { body }),

  updateSettings: (body) => request('PATCH', '/me/settings', { body }),

  listReadings: (params) => request('GET', '/readings', { params }),
  createReading: (body) => request('POST', '/readings', { body }),
  updateReading: (id, body) => request('PUT', `/readings/${id}`, { body }),
  deleteReading: (id) => request('DELETE', `/readings/${id}`),
  /** Downloads the CSV through fetch so the auth header is sent, then triggers a file save. */
  async exportCsv(params) {
    const res = await raw('GET', '/readings/export.csv', { params });
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement('a'), { href: url, download: 'sweety-readings.csv' });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

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
