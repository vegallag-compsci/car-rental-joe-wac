import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import UserMenu from './UserMenu'

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { status, user, signOut } = useAuth()
  const navigate = useNavigate()

  // The Admin link is a convenience only; RLS is what limits admin actions.
  const links = [
    { to: '/cars', label: 'Find a car' },
    { to: '/reviews', label: 'Reviews' },
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
  // from "Log in" to the profile picture.
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

        <div className="nav-right">
          <nav className="nav-links">{renderLinks()}</nav>

          {status === 'signedIn' && <UserMenu user={user} onSignOut={handleSignOut} />}

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
      </div>

      <nav className={menuOpen ? 'nav-menu open' : 'nav-menu'}>
        {renderLinks()}
        {/* On phones the bar only has room for the role and picture, so
            Log out moves into the drop-down. */}
        {status === 'signedIn' && (
          <button type="button" className="nav-link" onClick={handleSignOut}>
            Log out
          </button>
        )}
      </nav>
    </header>
  )
}
