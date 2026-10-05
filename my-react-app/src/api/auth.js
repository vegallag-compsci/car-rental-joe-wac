// Login calls. Google sign-in itself is a full-page redirect through Flask
// (api/app/routes/auth.py), so it's a URL rather than a request.
import { BASE_URL, request } from './client'

export function googleLoginUrl(next = '/') {
  return `${BASE_URL}/api/auth/google?next=${encodeURIComponent(next)}`
}

/** Trade a refresh token for a new { access_token, refresh_token, expires_at }. */
export function refreshSession(refreshToken) {
  return request('/api/auth/refresh', {
    method: 'POST',
    body: { refresh_token: refreshToken },
  })
}

/** { id, email, name, avatar_url, role } for the current access token. */
export function getMe({ signal } = {}) {
  return request('/api/auth/me', { signal })
}

export function logout() {
  return request('/api/auth/logout', { method: 'POST' })
}
