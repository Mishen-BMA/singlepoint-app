const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/$/, '');
const TOKEN_KEY = 'singlepoint-token';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
let inactivityTimer;

function saveToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token);
  window.clearTimeout(inactivityTimer);
  inactivityTimer = window.setTimeout(() => {
    clearToken();
    window.dispatchEvent(new Event('singlepoint:unauthorized'));
  }, SESSION_TIMEOUT_MS);
}

export function clearToken() {
  window.clearTimeout(inactivityTimer);
  sessionStorage.removeItem(TOKEN_KEY);
}

export function getToken() {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (token) saveToken(token);
  return token;
}

export async function api(path, options = {}) {
  const { auth = true, responseType = 'json', body, headers = {}, ...requestOptions } = options;
  const requestHeaders = { ...headers };
  if (body !== undefined && !(body instanceof FormData)) {
    requestHeaders['Content-Type'] = 'application/json';
  }
  const token = auth ? getToken() : null;
  if (token) requestHeaders.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${path}`, {
    ...requestOptions,
    headers: requestHeaders,
    body: body === undefined || body instanceof FormData ? body : JSON.stringify(body)
  });

  const refreshedToken = response.headers.get('X-Auth-Token');
  if (refreshedToken) saveToken(refreshedToken);

  if (response.status === 401 && auth) {
    clearToken();
    window.dispatchEvent(new Event('singlepoint:unauthorized'));
  }

  if (responseType === 'blob') {
    if (!response.ok) throw new Error('Request failed');
    return response.blob();
  }

  const contentType = response.headers.get('Content-Type') || '';
  const result = contentType.includes('application/json')
    ? await response.json()
    : await response.text();
  if (!response.ok) {
    throw new Error(result.error || result.message || 'Request failed');
  }
  if (result && result.token) saveToken(result.token);
  return result;
}