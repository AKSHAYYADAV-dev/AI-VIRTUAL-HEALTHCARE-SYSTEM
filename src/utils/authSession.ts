import { User } from '../types/healthcare';

const SESSION_TOKEN_KEY = 'medassist_session_token_v1';
const LEGACY_USER_KEY = 'medassist_active_user_v1';

export function getStoredSessionToken(): string | null {
  try {
    return localStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveSessionToken(token: string | undefined | null): void {
  try {
    // Always remove legacy unverified user flag so auth never trusts a plain localStorage object
    localStorage.removeItem(LEGACY_USER_KEY);
    if (token && token.trim()) {
      localStorage.setItem(SESSION_TOKEN_KEY, token.trim());
    }
  } catch {
    // ignore storage errors in restricted contexts
  }
}

export function clearSessionToken(): void {
  try {
    localStorage.removeItem(SESSION_TOKEN_KEY);
    localStorage.removeItem(LEGACY_USER_KEY);
  } catch {
    // ignore storage errors
  }
}

export function buildAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...(extra || {}) };
  const token = getStoredSessionToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export interface SessionCheckResult {
  authenticated: boolean;
  user: User | null;
}

/**
 * Verifies the visitor's authentication state directly against the backend session
 * endpoint (validating the HttpOnly session cookie or signed Bearer token against
 * the persistent user database). Enforces a strict timeout so initialization can
 * never hang infinitely.
 */
export async function verifyAuthenticatedSession(
  externalSignal?: AbortSignal,
  timeoutMs = 8000
): Promise<SessionCheckResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error('Session check timed out')), timeoutMs);

  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', onExternalAbort, { once: true });

  try {
    const response = await fetch('/api/auth/session', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: buildAuthHeaders({ Accept: 'application/json' }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Session verification failed (${response.status})`);
    }

    const data = (await response.json()) as { authenticated?: boolean; user?: User | null };
    if (data.authenticated && data.user) {
      return { authenticated: true, user: data.user };
    }

    // Server confirmed no valid session — clear any stale token
    clearSessionToken();
    return { authenticated: false, user: null };
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}

export async function logoutAuthenticatedSession(): Promise<void> {
  clearSessionToken();
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
    });
  } catch {
    // ignore network failure during logout after local token is cleared
  }
}
