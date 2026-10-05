import { createContext, useContext } from 'react'

export const AuthContext = createContext(null)

/**
 *   const { status, user, signIn, signOut } = useAuth()
 *
 * status: 'loading' (checking for a saved login) | 'signedIn' | 'signedOut'
 * user:   { id, email, name, avatar_url, role } or null
 */
export function useAuth() {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('useAuth must be used inside <AuthProvider>.')
  return auth
}
