import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { status, user, signOut } = useAuth()
  const navigate = useNavigate()

  // The Admin link is a convenience only; RLS is what limits admin actions.
  const links = [
    { to: '/cars', label: 'Find a car' },
    { to: '/bookings', label: 'My bookings' },
    ...(user?.role === 'admin' ? [{ to: '/admin', label: 'Admin' }] : []),
  ]

  async function handleSignOut() {
    setMenuOpen(false)
    await signOut()
    navigate('/')
  }

  // Rendered twice: desktop row + mobile drop-down. Nothing auth-related
  // shows while a saved login is still being checked, to avoid a flicker
  // from "Log in" to "Log out".
  function renderLinks() {
    return (
      <>
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className="nav-link"
            onClick={() => setMenuOpen(false)}
          >
            {link.label}
          </NavLink>
        ))}

        {status === 'signedIn' && (
          <button
            type="button"
            className="nav-link"
            title={`Signed in as ${user.email}`}
            onClick={handleSignOut}
          >
            Log out
          </button>
        )}

        {status === 'signedOut' && (
          <NavLink to="/login" className="nav-link" onClick={() => setMenuOpen(false)}>
            Log in
          </NavLink>
        )}
      </>
    )
  }

  return (
    <header className="nav">
      <div className="nav-inner">
        <Link to="/" className="nav-logo" onClick={() => setMenuOpen(false)}>
          CarRental
        </Link>

        <nav className="nav-links">{renderLinks()}</nav>

        <button
          type="button"
          className="nav-toggle"
          aria-expanded={menuOpen}
          aria-label="Toggle menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      <nav className={menuOpen ? 'nav-menu open' : 'nav-menu'}>{renderLinks()}</nav>
    </header>
  )
}
