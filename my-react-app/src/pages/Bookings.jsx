import { useState } from 'react'
import { Link } from 'react-router-dom'
import StatusBadge from '../components/StatusBadge'
import {
  bookings as mockBookings,
  daysBetween,
  formatDate,
  formatMoney,
  getCarById,
  getCarLabel,
} from '../data/mockCars'

// Only these two statuses can still be called off.
const cancellable = ['pending', 'confirmed']

export default function Bookings() {
  // Local copy so the Cancel button can change the badge. This is UI only —
  // nothing is persisted, and a refresh resets the list.
  const [bookings, setBookings] = useState(mockBookings)

  function cancelBooking(bookingId) {
    setBookings((current) =>
      current.map((booking) =>
        booking.id === bookingId ? { ...booking, status: 'cancelled' } : booking
      )
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>My bookings</h1>
        <p>Your reservations, past and upcoming.</p>
      </div>

      {bookings.length === 0 ? (
        <div className="empty-state glass">
          <p>You don&apos;t have any bookings yet.</p>
          <Link to="/cars" className="btn" style={{ marginTop: 16 }}>
            Find a car
          </Link>
        </div>
      ) : (
        <div className="booking-list">
          {bookings.map((booking) => {
            const car = getCarById(booking.car_id)
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
                      onClick={() => cancelBooking(booking.id)}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
