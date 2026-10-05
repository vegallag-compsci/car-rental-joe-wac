import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { createBooking } from '../api/bookings'
import { useAuth } from '../auth/AuthContext'
import { getCar } from '../api/cars'
import CategoryBadge from '../components/CategoryBadge'
import LoadState from '../components/LoadState'
import { useAsync } from '../hooks/useAsync'
import { useCategories } from '../hooks/useCategories'
import { dateInDays, daysBetween, formatMoney } from '../utils/format'

// Turn a failed createBooking call into something a customer can act on.
function bookingErrorMessage(error) {
  if (error.status === 401) return 'Your session ended. Please log in again.'
  // 409 covers both "already booked for those dates" (the no-overlap
  // constraint) and "car no longer available"; the API message says which.
  return error.message
}

export default function CarDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { getCategoryName } = useCategories()
  const { status, signIn } = useAuth()

  const { loading, data: car, error, reload } = useAsync(
    (signal) => getCar(id, { signal }),
    [id]
  )

  // Pre-fill with dates from the search if the user came from there,
  // otherwise a sensible 3-day trip starting today.
  const [pickup, setPickup] = useState(
    searchParams.get('pickup') || dateInDays(0)
  )
  const [dropoff, setDropoff] = useState(
    searchParams.get('return') || dateInDays(3)
  )
  const [reserving, setReserving] = useState(false)
  const [bookingError, setBookingError] = useState(null)

  if (error?.status === 404) {
    return (
      <div className="page">
        <div className="empty-state glass">
          <p>We couldn&apos;t find that car.</p>
          <Link to="/cars" className="btn" style={{ marginTop: 16 }}>
            Back to all cars
          </Link>
        </div>
      </div>
    )
  }

  if (loading || error) {
    return (
      <div className="page">
        <LoadState loading={loading} error={error} onRetry={reload} loadingText="Loading car…" />
      </div>
    )
  }

  // An estimate for display only. The database computes the real
  // total_price when the booking is created (set_booking_price trigger).
  const days = daysBetween(pickup, dropoff)
  const total = days * car.daily_rate

  async function handleReserve() {
    // Come back to this car with the same dates after signing in.
    if (status !== 'signedIn') {
      signIn(`/cars/${car.id}?pickup=${pickup}&return=${dropoff}`)
      return
    }

    setReserving(true)
    setBookingError(null)
    try {
      await createBooking({ carId: car.id, pickup, dropoff })
      navigate('/bookings')
    } catch (err) {
      setBookingError(err)
      setReserving(false)
    }
  }

  let reserveLabel = 'Reserve'
  if (reserving) reserveLabel = 'Reserving…'
  else if (status === 'signedOut') reserveLabel = 'Log in to reserve'

  const specs = [
    { label: 'Make', value: car.make },
    { label: 'Model', value: car.model },
    { label: 'Year', value: car.year },
    { label: 'Color', value: car.color },
    { label: 'Seats', value: car.seats },
    { label: 'Transmission', value: car.transmission },
    { label: 'Mileage', value: `${car.mileage.toLocaleString('en-US')} mi` },
    { label: 'Category', value: getCategoryName(car.category_id) },
  ]

  return (
    <div className="page">
      <Link to="/cars" className="back-link">
        ← Back to all cars
      </Link>

      <div className="detail-layout">
        <div>
          <img
            className="detail-image"
            src={car.image_url}
            alt={`${car.make} ${car.model}`}
          />

          <div className="page-header" style={{ marginTop: 28 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <h1>
                {car.make} {car.model}
              </h1>
              <CategoryBadge categoryId={car.category_id} />
            </div>
            <p>
              {car.year} · {car.seats} seats · {car.transmission}
            </p>
          </div>

          <dl className="spec-list">
            {specs.map((spec) => (
              <div key={spec.label} className="spec">
                <dt>{spec.label}</dt>
                <dd>{spec.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <aside className="booking-box glass">
          <div className="booking-box-rate">
            <div className="price">
              <strong>{formatMoney(car.daily_rate)}</strong>
              <span>/ day</span>
            </div>
          </div>

          <div className="field">
            <label htmlFor="booking-pickup">Pickup date</label>
            <input
              id="booking-pickup"
              type="date"
              value={pickup}
              min={dateInDays(0)}
              // Bookings open at most a year ahead (enforce_booking_limits in 002).
              max={dateInDays(365)}
              onChange={(e) => setPickup(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="booking-return">Return date</label>
            <input
              id="booking-return"
              type="date"
              value={dropoff}
              min={pickup}
              onChange={(e) => setDropoff(e.target.value)}
            />
          </div>

          <div className="summary-row">
            <span>
              {formatMoney(car.daily_rate)} × {days}{' '}
              {days === 1 ? 'day' : 'days'}
            </span>
            <span>{formatMoney(total)}</span>
          </div>

          <div className="summary-total">
            <span>Total</span>
            <strong>{formatMoney(total)}</strong>
          </div>

          <button
            type="button"
            className="btn btn-block"
            disabled={days === 0 || reserving || status === 'loading'}
            onClick={handleReserve}
          >
            {reserveLabel}
          </button>

          {bookingError ? (
            <p className="form-error" role="alert" style={{ textAlign: 'center', marginBottom: 0 }}>
              {bookingErrorMessage(bookingError)}
            </p>
          ) : (
            <p className="faint" style={{ fontSize: '0.82rem', textAlign: 'center' }}>
              {days === 0
                ? 'Pick a return date after your pickup date.'
                : 'You won’t be charged yet.'}
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}
