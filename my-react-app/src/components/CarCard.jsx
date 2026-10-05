import { Link } from 'react-router-dom'
import CarImage from './CarImage'
import CategoryBadge from './CategoryBadge'
import { formatMileage, formatMoney, formatSeats, formatTransmission } from '../utils/format'

// `search` is an optional query string (e.g. "?pickup=...&return=...") so the
// details page can pre-fill the dates the user already searched for.
export default function CarCard({ car, search = '' }) {
  return (
    <article className="car-card glass">
      <CarImage
        className="car-card-image"
        src={car.image_url}
        alt={`${car.make} ${car.model}`}
        loading="lazy"
      />

      <div className="car-card-body">
        <div className="car-card-head">
          <h3>
            {car.make} {car.model} <span className="faint">{car.year}</span>
          </h3>
          <CategoryBadge categoryId={car.category_id} />
        </div>

        <ul className="spec-pills" aria-label="Key specs">
          <li>{formatSeats(car.seats)}</li>
          <li>{formatTransmission(car.transmission)}</li>
          <li>{formatMileage(car.mileage)}</li>
        </ul>

        <div className="car-card-footer">
          <div className="price">
            <strong>{formatMoney(car.daily_rate)}</strong>
            <span>/ day</span>
          </div>
          <Link to={`/cars/${car.id}${search}`} className="btn btn-sm">
            View
          </Link>
        </div>
      </div>
    </article>
  )
}
