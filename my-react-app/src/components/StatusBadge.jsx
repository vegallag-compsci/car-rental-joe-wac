// Booking status pill. Each status gets its own subtle color, defined in
// index.css as .badge-pending, .badge-confirmed, etc.
const labels = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  active: 'Active',
  returned: 'Returned',
  cancelled: 'Cancelled',
}

export default function StatusBadge({ status }) {
  return (
    <span className={`badge badge-${status}`}>{labels[status] ?? status}</span>
  )
}
