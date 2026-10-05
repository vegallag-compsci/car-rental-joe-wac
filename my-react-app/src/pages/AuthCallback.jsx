import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { sessionFromHash } from '../auth/session'

// Flask lands the browser here after Google sign-in, with the session in the
// URL fragment (#access_token=...). Store it, then move on, replacing this
// history entry so the tokens don't stay in the address bar or Back button.
export default function AuthCallback() {
  const { completeSignIn } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    let active = true
    const result = sessionFromHash(window.location.hash)

    if (!result) {
      navigate('/login', { replace: true })
      return
    }

    completeSignIn(result.session).then(
      () => active && navigate(result.next, { replace: true }),
      () =>
        active &&
        navigate(
          `/login?error=${encodeURIComponent("We couldn't finish signing you in. Please try again.")}`,
          { replace: true }
        )
    )

    return () => {
      active = false
    }
  }, [completeSignIn, navigate])

  return (
    <div className="page">
      <div className="empty-state glass" role="status">
        Signing you in…
      </div>
    </div>
  )
}
