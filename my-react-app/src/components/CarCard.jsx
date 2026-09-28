import { Link } from 'react-router-dom'
import CategoryBadge from './CategoryBadge'
import { formatMoney } from '../data/mockCars'

export default function CarCard({ car }) {
  return (
    <article className="car-card glass">
      <img
        className="car-card-image"
        src={car.image_url}
        alt={`${car.make} ${car.model}`}
        loading="lazy"
      />

      <div className="car-card-body">
        <div className="car-card-head">
          <h3>
            {car.make} {car.model}{' '}
            <span className="faint">{car.year}</span>
          </h3>
          <CategoryBadge categoryId={car.category_id} />
        </div>

        <div className="car-specs">
          <span>{car.seats} seats</span>
          <span style={{ textTransform: 'capitalize' }}>{car.transmission}</span>
        </div>

        <div className="car-card-footer">
          <div className="price">
            <strong>{formatMoney(car.daily_rate)}</strong>
            <span>/ day</span>
          </div>
          <Link to={`/cars/${car.id}`} className="btn btn-sm">
            View
          </Link>
        </div>
      </div>
    </article>
  )
}
