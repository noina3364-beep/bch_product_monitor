const browserHost =
  typeof window !== 'undefined' && window.location.hostname === '127.0.0.1'
    ? '127.0.0.1'
    : 'localhost';

const defaultApiBaseUrl = `http://${browserHost}:3001/api`;

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? defaultApiBaseUrl;

interface ApiErrorPayload {
  error?: string;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json')
    ? ((await response.json()) as unknown)
    : ((await response.text()) as unknown);

  if (!response.ok) {
    const errorMessage =
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      typeof (payload as ApiErrorPayload).error === 'string'
        ? (payload as ApiErrorPayload).error
        : `Request failed with status ${response.status}`;

    throw new Error(errorMessage);
  }

  return payload as T;
}
