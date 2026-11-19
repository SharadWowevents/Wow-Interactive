const API_BASE = '/api';

export const getToken = () => localStorage.getItem('wc_token');
export const setToken = (t) => t ? localStorage.setItem('wc_token', t) : localStorage.removeItem('wc_token');

export async function fetchApi(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    credentials: 'include',
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (response.status === 401) {
    setToken(null);
    throw new Error('AUTH_REQUIRED');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Something went wrong');
  }

  return data;
}

// Authentication
export const login = async (password) => {
  const data = await fetchApi('/login', { method: 'POST', body: { password } });
  if (data.token) setToken(data.token);
  return data;
};

export const logout = async () => {
  await fetchApi('/logout', { method: 'POST' }).catch(() => {});
  setToken(null);
};

export const checkAuth = async () => {
  try {
    const data = await fetchApi('/check');
    return data.authenticated;
  } catch {
    return false;
  }
};

export const changePassword = async (currentPassword, newPassword) => {
  const data = await fetchApi('/change-password', {
    method: 'POST',
    body: { currentPassword, newPassword }
  });
  if (data.token) setToken(data.token);
  return data;
};

// Admin Questions
export const getQuestions = () => fetchApi('/questions');
export const createQuestion = (data) => fetchApi('/questions', { method: 'POST', body: data });
export const updateQuestion = (id, data) => fetchApi(`/questions/${id}`, { method: 'PATCH', body: data });
export const clearQuestion = (id) => fetchApi(`/questions/${id}/clear`, { method: 'POST' });
export const deleteQuestion = (id) => fetchApi(`/questions/${id}`, { method: 'DELETE' });
export const getExportDates = (id) => fetchApi(`/questions/${id}/export-dates`);
export const exportCsvUrl = (id, from, to) =>
  from && to
    ? `/api/questions/${id}/export.csv?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    : `/api/questions/${id}/export.csv`;

// Public Questions
export const getPublicQuestion = (id) => fetchApi(`/public/questions/${id}`);
export const submitAnswer = (id, data) => fetchApi(`/public/questions/${id}/answer`, { method: 'POST', body: data });
export const getCloudData = (id) => fetchApi(`/public/questions/${id}/cloud`);
export const searchCities = async (query) => {
  if (!query || query.length < 2) return [];
  const res = await fetch(`/api/cities?q=${encodeURIComponent(query)}`);
  const data = await res.json().catch(() => ({ cities: [] }));
  return data.cities || [];
};
