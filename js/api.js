// ============================================================
// js/api.js
// Shared API layer for Finora Frontend
// Centralized fetch, JWT header management, and error handling
// ============================================================

const API_BASE_URL = 'http://localhost:5000/api';

/**
 * Retrieve current JWT token from localStorage.
 */
function getToken() {
  return localStorage.getItem('token');
}

/**
 * Save JWT token in localStorage.
 */
function setToken(token) {
  localStorage.setItem('token', token);
}

/**
 * Remove JWT token from localStorage.
 */
function removeToken() {
  localStorage.removeItem('token');
}

/**
 * Retrieve saved user data from localStorage.
 */
function getUser() {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Save user data in localStorage.
 */
function setUser(user) {
  localStorage.setItem('user', JSON.stringify(user));
}

/**
 * Remove user data from localStorage.
 */
function removeUser() {
  localStorage.removeItem('user');
}

/**
 * Clear authentication state and redirect to login page.
 */
function logout() {
  removeToken();
  removeUser();
  localStorage.removeItem('finora_session');
  window.location.href = 'index.html';
}

/**
 * Reusable fetch wrapper with automated JWT Authorization header,
 * base URL prepending, and centralized HTTP error handling.
 *
 * @param {string} endpoint - API path, e.g. '/transactions' or '/auth/login'
 * @param {RequestInit} [options={}] - Fetch configuration options
 * @returns {Promise<any>} - Parsed JSON response body
 */
async function apiFetch(endpoint, options = {}) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${cleanEndpoint}`;

  const headers = { ...(options.headers || {}) };

  // Attach token if present
  const token = getToken();
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Default to application/json if body exists and is string/object (and not FormData)
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const fetchOptions = {
    ...options,
    headers
  };

  let response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (netErr) {
    // Network error (server down, DNS, CORS failure, offline)
    const error = new Error('Unable to connect to the Finora server. Please make sure the API is running and try again.');
    error.status = 0;
    error.isNetworkError = true;
    error.originalError = netErr;
    throw error;
  }

  // Parse JSON response safely
  let data;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = {};
    }
  } else {
    try {
      const text = await response.text();
      data = { message: text };
    } catch {
      data = {};
    }
  }

  // Handle HTTP error statuses
  if (!response.ok) {
    // 401 Unauthorized handling:
    // If not on the login page (index.html), clear credentials and redirect to login.
    const isLoginPage =
      window.location.pathname.endsWith('index.html') ||
      window.location.pathname === '/' ||
      window.location.pathname.endsWith('/');

    if ((response.status === 401 || response.status === 403) && !isLoginPage) {
      removeToken();
      removeUser();
      localStorage.removeItem('finora_session');
      window.location.href = 'index.html';
    }

    // Determine error message according to status
    let message = data.error || data.message;
    if (!message) {
      switch (response.status) {
        case 400:
          message = 'Validation error. Please check your input.';
          break;
        case 401:
          message = 'Invalid credentials or session expired.';
          break;
        case 403:
          message = 'You do not have permission to perform this action.';
          break;
        case 404:
          message = 'Resource not found.';
          break;
        case 429:
          message = 'Too many attempts. Please try again later.';
          break;
        case 500:
        default:
          message = 'Internal server error. Please try again later.';
          break;
      }
    }

    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    error.details = data.details || null;
    throw error;
  }

  return data;
}

/**
 * Auth guard: Checks if token exists and optionally validates with /api/auth/me.
 * If invalid or expired, clears session and redirects to index.html.
 */
async function checkAuth() {
  const token = getToken();
  if (!token) {
    logout();
    return null;
  }

  try {
    const res = await apiFetch('/auth/me');
    if (res && res.data) {
      setUser(res.data);
      return res.data;
    }
    return getUser();
  } catch (err) {
    if (err.status === 401) {
      logout();
      return null;
    }
    // Return cached user data if offline/temporary network issue
    return getUser();
  }
}

// Expose utilities on window for vanilla JS scripts
window.API_BASE_URL = API_BASE_URL;
window.apiFetch = apiFetch;
window.getToken = getToken;
window.setToken = setToken;
window.removeToken = removeToken;
window.getUser = getUser;
window.setUser = setUser;
window.removeUser = removeUser;
window.logout = logout;
window.checkAuth = checkAuth;
