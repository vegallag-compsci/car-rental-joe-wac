import { useState } from 'react'
import { Link } from 'react-router-dom'
import { cancelBooking, getMyBookings } from '../api/bookings'
import LoadState from '../components/LoadState'
import StatusBadge from '../components/StatusBadge'
import { useAuth } from '../auth/AuthContext'
import { useAsync } from '../hooks/useAsync'
import { daysBetween, formatDate, formatMoney, getCarLabel } from '../utils/format'

// Only these two statuses can still be called off. The database enforces
// this too (bookings_cancel_own policy); this just hides the button.
const cancellable = ['pending', 'confirmed']

function EmptyState({ message, linkTo, linkText }) {
  return (
    <div className="empty-state glass">
      <p>{message}</p>
      <Link to={linkTo} className="btn" style={{ marginTop: 16 }}>
        {linkText}
      </Link>
    </div>
  )
}

function LoginPrompt() {
  return (
    <EmptyState
      message="Log in to see your bookings."
      linkTo="/login?next=/bookings"
      linkText="Log in"
    />
  )
}

export default function Bookings() {
  const { status } = useAuth()

  return (
    <div className="page">
      <div className="page-header">
        <h1>My bookings</h1>
        <p>Your reservations, past and upcoming.</p>
      </div>
      {status === 'loading' && <LoadState loading />}
      {status === 'signedOut' && <LoginPrompt />}
      {status === 'signedIn' && <BookingList />}
    </div>
  )
}

// Only mounted once signed in, so the request always carries a token.
function BookingList() {
  const { loading, data: bookings, error, reload, setData } = useAsync(
    (signal) => getMyBookings({ signal }),
    []
  )
  const [cancellingId, setCancellingId] = useState(null)
  const [cancelError, setCancelError] = useState(null)

  async function handleCancel(bookingId) {
    setCancellingId(bookingId)
    setCancelError(null)
    try {
      const updated = await cancelBooking(bookingId)
      // The cancel response has no embedded car, so merge rather than replace.
      setData((current) =>
        current.map((booking) =>
          booking.id === bookingId ? { ...booking, ...updated } : booking
        )
      )
    } catch (err) {
      setCancelError(err)
    } finally {
      setCancellingId(null)
    }
  }

  // A 401 here means the session ended after the page loaded.
  if (error?.status === 401) return <LoginPrompt />

  if (loading || error) {
    return (
      <LoadState loading={loading} error={error} onRetry={reload} loadingText="Loading bookings…" />
    )
  }

  if (bookings.length === 0) {
    return (
      <EmptyState
        message="You don't have any bookings yet."
        linkTo="/cars"
        linkText="Find a car"
      />
    )
  }

  return (
    <>
      {cancelError && (
        <p className="form-error" role="alert">
          {cancelError.message}
        </p>
      )}

      <div className="booking-list">
        {bookings.map((booking) => {
          const { car } = booking
          const days = daysBetween(booking.pickup_at, booking.return_at)

          return (
            <article key={booking.id} className="booking-card glass">
              <img
                className="booking-card-image"
                src={car?.image_url}
                alt={getCarLabel(car)}
                loading="lazy"
              />

              <div className="booking-card-info">
                <h3>{getCarLabel(car)}</h3>
                <div className="booking-card-meta">
                  <span>
                    {formatDate(booking.pickup_at)} →{' '}
                    {formatDate(booking.return_at)}
                  </span>
                  <span className="faint">
                    {days} {days === 1 ? 'day' : 'days'}
                  </span>
                </div>
                <div className="price">
                  <strong>{formatMoney(booking.total_price)}</strong>
                  <span>total</span>
                </div>
              </div>

              <div className="booking-card-actions">
                <StatusBadge status={booking.status} />
                {cancellable.includes(booking.status) && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={cancellingId === booking.id}
                    onClick={() => handleCancel(booking.id)}
                  >
                    {cancellingId === booking.id ? 'Cancelling…' : 'Cancel'}
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </>
  )
}
