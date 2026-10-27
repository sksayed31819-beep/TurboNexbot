/**
 * Frontend Admin Authentication Helper
 * Manages ADMIN_API_KEY session state and attaches Bearer authorization headers
 * to all protected Cloudflare Worker & local backend endpoints.
 */

const STORAGE_KEY = 'turbonex_admin_api_key';

export function getAdminApiKey(): string {
  try {
    return sessionStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setAdminApiKey(key: string): void {
  try {
    if (key && key.trim()) {
      sessionStorage.setItem(STORAGE_KEY, key.trim());
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch (err) {
    console.error('Failed to save admin API key to session storage:', err);
  }
}

export async function fetchWithAdminAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const key = getAdminApiKey();
  const headers = new Headers(options.headers || {});

  if (key) {
    headers.set('Authorization', `Bearer ${key}`);
    headers.set('X-Admin-Api-Key', key);
  }

  return fetch(url, {
    ...options,
    headers,
  });
}
