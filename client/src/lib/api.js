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

async function request(method, path, { body, params } = {}) {
  const qs = params
    ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString()
    : '';
  const token = tokenStore.get();
  let res;
  try {
    res = await fetch(`/api${path}${qs}`, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Cannot reach the server. Please check your connection and try again.');
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = data.error || {};
    if (res.status === 401 && token && path !== '/auth/login') onUnauthorized();
    throw new ApiError(e.message || 'Something went wrong. Please try again.', { status: res.status, field: e.field, code: e.code });
  }
  return data;
}

export const api = {
  signup: (body) => request('POST', '/auth/signup', { body }),
  login: (body) => request('POST', '/auth/login', { body }),
  me: () => request('GET', '/auth/me'),

  listReadings: (params) => request('GET', '/readings', { params }),
  createReading: (body) => request('POST', '/readings', { body }),
  updateReading: (id, body) => request('PUT', `/readings/${id}`, { body }),
  deleteReading: (id) => request('DELETE', `/readings/${id}`),

  report: (type, params) => request('GET', `/reports/${type}`, { params }),

  doctors: () => request('GET', '/me/doctors'),
  addDoctor: (email) => request('POST', '/me/doctors', { body: { email } }),
  removeDoctor: (id) => request('DELETE', `/me/doctors/${id}`),

  patients: () => request('GET', '/doctor/patients'),
};
