// ---------------------------------------------------------------------------
// Low-level fetch wrapper for the Flask API.
//
// Everything in src/api/ goes through request(). Components never call fetch
// directly, so error handling and auth headers only exist in one place.
// ---------------------------------------------------------------------------

export const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

// The logged-in user's Supabase JWT, attached to every request. Kept in
// memory only; src/auth/session.js sets it on login and on each refresh.
let accessToken = null

export function setAccessToken(token) {
  accessToken = token || null
}

export function getAccessToken() {
  return accessToken
}

/** Error carrying the API's status and machine-readable code. */
export class ApiError extends Error {
  constructor(message, status, code) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export async function request(path, { method = 'GET', body, signal } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  let response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (err) {
    // An aborted request isn't a failure — let callers ignore it.
    if (err.name === 'AbortError') throw err
    throw new ApiError(
      `Can't reach the API at ${BASE_URL}. Is the Flask server running?`,
      0,
      'network_error'
    )
  }

  if (response.status === 204) return null

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new ApiError(
      payload?.error?.message || `Request failed (${response.status}).`,
      response.status,
      payload?.error?.code || 'error'
    )
  }

  return payload
}

/** Build a query string, skipping empty values. */
export function query(params) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '' && value !== 'all') {
      search.set(key, value)
    }
  }
  const string = search.toString()
  return string ? `?${string}` : ''
}
