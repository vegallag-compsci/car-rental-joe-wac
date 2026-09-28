import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'

// Links are listed once and rendered twice: desktop row + mobile drop-down.
const links = [
  { to: '/cars', label: 'Find a car' },
  { to: '/bookings', label: 'My bookings' },
  { to: '/login', label: 'Log in' },
]

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="nav">
      <div className="nav-inner">
        <Link to="/" className="nav-logo" onClick={() => setMenuOpen(false)}>
          CarRental
        </Link>

        <nav className="nav-links">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} className="nav-link">
              {link.label}
            </NavLink>
          ))}
        </nav>

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

      <nav className={menuOpen ? 'nav-menu open' : 'nav-menu'}>
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
      </nav>
    </header>
  )
}
