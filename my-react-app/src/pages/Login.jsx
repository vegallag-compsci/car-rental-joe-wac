// Visual only. No auth yet — the form does not submit anywhere.
export default function Login() {
  return (
    <div className="auth-wrap">
      <form className="auth-card glass" onSubmit={(e) => e.preventDefault()}>
        <div>
          <h1>Welcome back</h1>
          <p className="muted" style={{ marginTop: 6 }}>
            Log in to manage your bookings.
          </p>
        </div>

        <div className="field">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
          />
        </div>

        <div className="field">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </div>

        <button type="submit" className="btn btn-block">
          Log in
        </button>

        <div className="auth-divider">or</div>

        <button type="button" className="btn btn-ghost btn-block">
          Continue with Google
        </button>

        <p className="auth-footnote">
          No account yet? <a href="#signup">Sign up</a>
        </p>
      </form>
    </div>
  )
}
