import Avatar from './Avatar'
import RoleBadge from './RoleBadge'

// Shown only while signed in. The role pill is display only: what an admin
// can actually do is enforced by RLS (is_admin()), not by this label.

// authuser picks the right account when several Google accounts are signed
// in to the same browser.
function googleAccountUrl(email) {
  return `https://myaccount.google.com/?authuser=${encodeURIComponent(email)}`
}

export default function UserMenu({ user, onSignOut }) {
  return (
    <div className="user-menu">
      <RoleBadge role={user.role} />

      <a
        href={googleAccountUrl(user.email)}
        target="_blank"
        rel="noopener noreferrer"
        className="avatar-link"
        title={`${user.email}: manage your Google Account`}
      >
        <Avatar src={user.avatar_url} name={user.name || user.email} />
      </a>

      <button type="button" className="nav-link user-menu-logout" onClick={onSignOut}>
        Log out
      </button>
    </div>
  )
}
