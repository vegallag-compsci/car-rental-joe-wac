import { useState } from 'react'
import CategoryBadge from '../components/CategoryBadge'
import { cars as mockCars, formatMoney } from '../data/mockCars'

export default function Admin() {
  // Local copy so the active toggle visibly flips. UI only — nothing saves.
  const [cars, setCars] = useState(mockCars)

  function toggleActive(carId) {
    setCars((current) =>
      current.map((car) =>
        car.id === carId ? { ...car, is_active: !car.is_active } : car
      )
    )
  }

  const activeCount = cars.filter((car) => car.is_active).length
  const averageRate = Math.round(
    cars.reduce((sum, car) => sum + car.daily_rate, 0) / cars.length
  )

  return (
    <div className="page">
      <div className="admin-head">
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1>Fleet admin</h1>
          <p>Manage the cars customers can book.</p>
        </div>
        <button type="button" className="btn">
          + Add car
        </button>
      </div>

      <dl className="stat-row">
        <div className="stat glass">
          <dt>Total cars</dt>
          <dd>{cars.length}</dd>
        </div>
        <div className="stat glass">
          <dt>Active</dt>
          <dd>{activeCount}</dd>
        </div>
        <div className="stat glass">
          <dt>Average rate</dt>
          <dd>{formatMoney(averageRate)}</dd>
        </div>
      </dl>

      <div className="table-wrap glass">
        <table>
          <thead>
            <tr>
              <th>Car</th>
              <th>Category</th>
              <th>Daily rate</th>
              <th>Active</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {cars.map((car) => (
              <tr key={car.id}>
                <td>
                  {car.make} {car.model}{' '}
                  <span className="faint">{car.year}</span>
                </td>
                <td>
                  <CategoryBadge categoryId={car.category_id} />
                </td>
                <td>{formatMoney(car.daily_rate)}</td>
                <td>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={car.is_active}
                    aria-label={`Toggle ${car.make} ${car.model}`}
                    className="toggle"
                    onClick={() => toggleActive(car.id)}
                  />
                </td>
                <td>
                  <button type="button" className="btn btn-ghost btn-sm">
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
