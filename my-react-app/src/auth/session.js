// Where the login tokens live, and how they're renewed.
//
// - The access token (1 hour) is kept in memory only, in api/client.js.
// - The refresh token is kept in localStorage so a login survives reloads
//   and new tabs. That is the same trade-off supabase-js makes by default;
//   it means an XSS bug could steal it, so never render untrusted HTML.
import { refreshSession } from '../api/auth'
import { setAccessToken } from '../api/client'

// Must match the path Flask redirects to in api/app/routes/auth.py.
export const AUTH_CALLBACK_PATH = '/auth/callback'

const REFRESH_TOKEN_KEY = 'carrental.refreshToken'

// localStorage can throw (private mode, blocked storage), so every access
// is wrapped. Without storage the user just has to log in again on reload.
function readRefreshToken() {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY)
  } catch {
    return null
  }
}

function writeRefreshToken(token) {
  try {
    if (token) localStorage.setItem(REFRESH_TOKEN_KEY, token)
    else localStorage.removeItem(REFRESH_TOKEN_KEY)
  } catch {
    // Storage unavailable; the session still works until the tab closes.
  }
}

export function storeSession(session) {
  setAccessToken(session.access_token)
  writeRefreshToken(session.refresh_token)
}

export function clearSession() {
  setAccessToken(null)
  writeRefreshToken(null)
}

// Refresh tokens are single-use, so two refreshes racing each other (React
// StrictMode runs effects twice in dev) must share one request.
let refreshing = null

/**
 * Swap the stored refresh token for a fresh session and store it.
 * Resolves to the session, or null if there is no usable login. Network
 * errors are thrown, so a down API doesn't log the user out.
 */
export function resumeSession() {
  refreshing ??= (async () => {
    // Read storage each time: another tab may have rotated the token.
    const refreshToken = readRefreshToken()
    if (!refreshToken) return null
    try {
      const session = await refreshSession(refreshToken)
      storeSession(session)
      return session
    } catch (error) {
      if (error.status === 401) {
        clearSession()
        return null
      }
      throw error
    }
  })().finally(() => {
    refreshing = null
  })
  return refreshing
}

/** Read the session Flask put in the URL fragment after Google sign-in. */
export function sessionFromHash(hash) {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const session = {
    access_token: params.get('access_token'),
    refresh_token: params.get('refresh_token'),
    expires_at: Number(params.get('expires_at')),
  }
  if (!session.access_token || !session.refresh_token) return null
  return { session, next: safeRedirectPath(params.get('next')) }
}

/** Only allow same-site paths, never "https://..." or "//other.site". */
export function safeRedirectPath(path) {
  return path && path.startsWith('/') && !path.startsWith('//') && !path.includes('\\')
    ? path
    : '/'
}
