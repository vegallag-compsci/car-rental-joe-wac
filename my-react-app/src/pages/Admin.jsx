import { getCars } from '../api/cars'
import CategoryBadge from '../components/CategoryBadge'
import LoadState from '../components/LoadState'
import { useAsync } from '../hooks/useAsync'
import { formatMoney } from '../utils/format'

// Read-only for now: there are no admin API routes yet (roadmap step 4), so
// this lists the public fleet, which leaves out inactive cars. Once
// api/app/routes/admin.py exists, swap getCars for an admin call that
// includes inactive cars and wire the toggle to queries.set_car_active.
const NOT_WIRED = 'Needs the admin API (not built yet)'

export default function Admin() {
  const { loading, data: cars, error, reload } = useAsync(
    (signal) => getCars({ signal }),
    []
  )

  if (loading || error) {
    return (
      <div className="page">
        <LoadState loading={loading} error={error} onRetry={reload} loadingText="Loading fleet…" />
      </div>
    )
  }

  const categoryCount = new Set(cars.map((car) => car.category_id)).size
  const averageRate = cars.length
    ? cars.reduce((sum, car) => sum + Number(car.daily_rate), 0) / cars.length
    : 0

  return (
    <div className="page">
      <div className="admin-head">
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1>Fleet admin</h1>
          <p>Read-only until admin endpoints land. Inactive cars are hidden.</p>
        </div>
        <button type="button" className="btn" disabled title={NOT_WIRED}>
          + Add car
        </button>
      </div>

      <dl className="stat-row">
        <div className="stat glass">
          <dt>Bookable cars</dt>
          <dd>{cars.length}</dd>
        </div>
        <div className="stat glass">
          <dt>Categories</dt>
          <dd>{categoryCount}</dd>
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
                    aria-label={`${car.make} ${car.model} active`}
                    className="toggle"
                    disabled
                    title={NOT_WIRED}
                  />
                </td>
                <td>
                  <button type="button" className="btn btn-ghost btn-sm" disabled title={NOT_WIRED}>
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
