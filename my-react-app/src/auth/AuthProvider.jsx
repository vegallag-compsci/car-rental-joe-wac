import { useCallback, useEffect, useMemo, useState } from 'react'
import { getMe, googleLoginUrl, logout } from '../api/auth'
import { AuthContext } from './AuthContext'
import {
  AUTH_CALLBACK_PATH,
  clearSession,
  resumeSession,
  sessionFromHash,
  storeSession,
} from './session'

// Refresh a minute before the access token expires, and retry after a
// network failure rather than logging the user out.
const REFRESH_EARLY_MS = 60_000
const RETRY_MS = 30_000

const SIGNED_OUT = { status: 'signedOut', user: null }

export default function AuthProvider({ children }) {
  const [auth, setAuth] = useState({ status: 'loading', user: null })
  const [refreshAt, setRefreshAt] = useState(null)

  const scheduleRefresh = useCallback((session) => {
    setRefreshAt(session.expires_at * 1000 - REFRESH_EARLY_MS)
  }, [])

  const endSession = useCallback(() => {
    clearSession()
    setRefreshAt(null)
    setAuth(SIGNED_OUT)
  }, [])

  // Called by the /auth/callback page with the session Flask handed back.
  const completeSignIn = useCallback(
    async (session) => {
      storeSession(session)
      try {
        const user = await getMe()
        scheduleRefresh(session)
        setAuth({ status: 'signedIn', user })
      } catch (error) {
        endSession()
        throw error
      }
    },
    [scheduleRefresh, endSession]
  )

  // On first load, pick up a previous login from the stored refresh token.
  // Skipped when the callback page is completing a brand-new login.
  useEffect(() => {
    const isNewLogin =
      window.location.pathname === AUTH_CALLBACK_PATH &&
      sessionFromHash(window.location.hash) !== null
    if (isNewLogin) return

    resumeSession()
      .then((session) => (session ? completeSignIn(session) : setAuth(SIGNED_OUT)))
      // API unreachable: show signed out, but keep the token for next time.
      .catch(() => setAuth(SIGNED_OUT))
  }, [completeSignIn])

  // Keep the access token fresh while the tab is open.
  useEffect(() => {
    if (refreshAt === null) return

    const timer = setTimeout(() => {
      resumeSession().then(
        (session) => (session ? scheduleRefresh(session) : endSession()),
        () => setRefreshAt(Date.now() + RETRY_MS)
      )
    }, Math.max(refreshAt - Date.now(), 0))

    return () => clearTimeout(timer)
  }, [refreshAt, scheduleRefresh, endSession])

  const value = useMemo(
    () => ({
      ...auth,
      completeSignIn,
      // A full-page redirect to Google via Flask; `next` is where to land after.
      signIn(next = '/') {
        window.location.assign(googleLoginUrl(next))
      },
      async signOut() {
        try {
          await logout()
        } catch {
          // Revoking server-side is best effort; forgetting locally is what matters.
        }
        endSession()
      },
    }),
    [auth, completeSignIn, endSession]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
