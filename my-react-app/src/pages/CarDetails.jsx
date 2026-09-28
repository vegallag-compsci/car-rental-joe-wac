import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import CategoryBadge from '../components/CategoryBadge'
import {
  daysBetween,
  formatMoney,
  getCarById,
  getCategoryName,
} from '../data/mockCars'

// Returns a YYYY-MM-DD string for "today + offset days", which is the format
// <input type="date"> expects.
function dateInDays(offset) {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return date.toISOString().slice(0, 10)
}

export default function CarDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const car = getCarById(id)

  // Pre-fill with dates from the search bar if the user came from there,
  // otherwise a sensible 3-day trip starting today.
  const [pickup, setPickup] = useState(
    searchParams.get('pickup') || dateInDays(0)
  )
  const [dropoff, setDropoff] = useState(
    searchParams.get('return') || dateInDays(3)
  )

  if (!car) {
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

  const days = daysBetween(pickup, dropoff)
  const total = days * car.daily_rate

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
            disabled={days === 0}
            onClick={() => navigate('/bookings')}
          >
            Reserve
          </button>

          <p className="faint" style={{ fontSize: '0.82rem', textAlign: 'center' }}>
            {days === 0
              ? 'Pick a return date after your pickup date.'
              : 'You won’t be charged yet.'}
          </p>
        </aside>
      </div>
    </div>
  )
}
