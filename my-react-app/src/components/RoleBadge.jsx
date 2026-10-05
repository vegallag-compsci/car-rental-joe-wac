// Role pill used in the nav and the admin Users tab. The database role is
// 'customer'; the site shows it as "Guest".
const LABELS = {
  admin: 'Admin',
  customer: 'Guest',
}

export default function RoleBadge({ role }) {
  const known = role in LABELS ? role : 'customer'
  return <span className={`badge badge-role-${known}`}>{LABELS[known]}</span>
}
