import { useCallback, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useOverlay } from '../hooks/useOverlay'
import { CloseIcon, MenuIcon } from './icons'
import RoleBadge from './RoleBadge'
import ThemeToggle from './ThemeToggle'
import UserMenu from './UserMenu'

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = useCallback(() => setMenuOpen(false), [])
  const { triggerRef, panelRef } = useOverlay(menuOpen, closeMenu)
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
    closeMenu()
    await signOut()
    navigate('/')
  }

  // Rendered twice: desktop bar + mobile drawer. Nothing auth-related
  // shows while a saved login is still being checked, to avoid a flicker
  // from "Log in" to the profile picture.
  function renderLinks() {
    return (
      <>
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} className="nav-link" onClick={closeMenu}>
            {link.label}
          </NavLink>
        ))}

        {status === 'signedOut' && (
          <NavLink to="/login" className="nav-link" onClick={closeMenu}>
            Log in
          </NavLink>
        )}
      </>
    )
  }

  return (
    <header className="nav">
      <div className="nav-bar glass glass-medium">
        <Link to="/" className="nav-logo" onClick={closeMenu}>
          CarRental
        </Link>

        <nav className="nav-links" aria-label="Main">
          {renderLinks()}
        </nav>

        <div className="nav-actions">
          {status === 'signedIn' && <UserMenu user={user} onSignOut={handleSignOut} />}
          <ThemeToggle />
          <button
            ref={triggerRef}
            type="button"
            className="icon-btn nav-menu-button"
            aria-expanded={menuOpen}
            aria-controls="nav-drawer"
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
          >
            <MenuIcon />
          </button>
        </div>
      </div>

      {/* The drawer lives outside .nav-bar: a backdrop-filter ancestor would
          become its containing block and trap the fixed positioning. */}
      <div className="scrim nav-scrim" data-open={menuOpen} aria-hidden="true" onClick={closeMenu} />

      <nav
        id="nav-drawer"
        ref={panelRef}
        tabIndex={-1}
        className="nav-drawer glass glass-strong"
        data-open={menuOpen}
        aria-label="Main"
      >
        <div className="nav-drawer-head">
          {status === 'signedIn' && <RoleBadge role={user.role} />}
          <button type="button" className="icon-btn" aria-label="Close menu" onClick={closeMenu}>
            <CloseIcon />
          </button>
        </div>

        {renderLinks()}

        {/* On small screens the bar only has room for the picture, so
            Log out lives in the drawer. */}
        {status === 'signedIn' && (
          <button type="button" className="nav-link" onClick={handleSignOut}>
            Log out
          </button>
        )}
      </nav>
    </header>
  )
}
