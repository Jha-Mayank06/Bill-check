// Small API client for the Bill Check backend.
// Set EXPO_PUBLIC_API_URL to the backend address, e.g. http://192.168.1.20:4000
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '');

let authToken = null;
let onUnauthorized = () => {};

export function setAuthToken(token) {
  authToken = token;
}

export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(method, path, body) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your internet connection.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && authToken) onUnauthorized();
    throw new ApiError(res.status, data.error || `Request failed (${res.status})`);
  }
  return data;
}

const qs = (params) => {
  const parts = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return parts.length ? `?${parts.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}` : '';
};

export const api = {
  login: (empId, password) => request('POST', '/auth/login', { empId, password }),
  me: () => request('GET', '/auth/me'),

  listUsers: (role) => request('GET', `/users${qs({ role })}`),
  createUser: (user) => request('POST', '/users', user),
  updateUser: (id, changes) => request('PATCH', `/users/${id}`, changes),

  listBills: (filters = {}) => request('GET', `/bills${qs(filters)}`),
  getBill: (id) => request('GET', `/bills/${id}`),
  createBill: (bill) => request('POST', '/bills', bill),
  assignBill: (id, driverId) => request('POST', `/bills/${id}/assign`, { driverId }),
  cancelBill: (id, reason) => request('POST', `/bills/${id}/cancel`, { reason }),
  markLoaded: (id) => request('POST', `/bills/${id}/loaded`),
  markLeft: (id) => request('POST', `/bills/${id}/left`),
  resendOtp: (id) => request('POST', `/bills/${id}/resend-otp`),
  deliver: (id, otp) => request('POST', `/bills/${id}/deliver`, { otp }),
};
