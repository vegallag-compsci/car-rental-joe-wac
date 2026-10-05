import { useState } from 'react'

// Shown only while signed in. The role pill is display only: what an admin
// can actually do is enforced by RLS (is_admin()), not by this label.
const ROLE_LABELS = {
  admin: 'Admin',
  customer: 'Guest',
}

// authuser picks the right account when several Google accounts are signed
// in to the same browser.
function googleAccountUrl(email) {
  return `https://myaccount.google.com/?authuser=${encodeURIComponent(email)}`
}

export default function UserMenu({ user, onSignOut }) {
  return (
    <div className="user-menu">
      <span className={`badge badge-role-${user.role}`}>
        {ROLE_LABELS[user.role] ?? ROLE_LABELS.customer}
      </span>

      <a
        href={googleAccountUrl(user.email)}
        target="_blank"
        rel="noopener noreferrer"
        className="avatar-link"
        title={`${user.email}: manage your Google Account`}
      >
        <Avatar user={user} />
      </a>

      <button type="button" className="nav-link user-menu-logout" onClick={onSignOut}>
        Log out
      </button>
    </div>
  )
}

// Google profile photo, falling back to the first letter of the user's
// name if there's no photo or it fails to load.
function Avatar({ user }) {
  const [failed, setFailed] = useState(false)
  const label = user.name || user.email

  if (!user.avatar_url || failed) {
    return (
      <span className="avatar" aria-label={label}>
        {label.charAt(0).toUpperCase()}
      </span>
    )
  }

  return (
    <img
      className="avatar"
      src={user.avatar_url}
      alt={label}
      // Google's image host sometimes refuses requests that carry a Referer
      // from another site, which would show a broken image.
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  )
}
