import { useState } from 'react'
import { getAdminCars, updateCar } from '../../api/admin'
import CategoryBadge from '../../components/CategoryBadge'
import LoadState from '../../components/LoadState'
import { useAsync } from '../../hooks/useAsync'
import { formatMoney } from '../../utils/format'
import CarForm from './CarForm'

export default function FleetPanel() {
  const { loading, data: cars, error, reload, setData } = useAsync(
    (signal) => getAdminCars({ signal }),
    []
  )
  // null = no form open, 'new' = adding, otherwise the car being edited.
  const [editing, setEditing] = useState(null)
  const [savingId, setSavingId] = useState(null)
  const [saveError, setSaveError] = useState(null)

  function upsert(saved) {
    setData((current) =>
      current.some((c) => c.id === saved.id)
        ? current.map((c) => (c.id === saved.id ? { ...c, ...saved } : c))
        : [...current, saved]
    )
  }

  async function toggleActive(car) {
    setSavingId(car.id)
    setSaveError(null)
    try {
      upsert(await updateCar(car.id, { is_active: !car.is_active }))
    } catch (err) {
      setSaveError(err)
    } finally {
      setSavingId(null)
    }
  }

  if (loading || error) {
    return <LoadState loading={loading} error={error} onRetry={reload} loadingText="Loading fleet…" />
  }

  const activeCount = cars.filter((car) => car.is_active).length
  const averageRate = cars.length
    ? cars.reduce((sum, car) => sum + Number(car.daily_rate), 0) / cars.length
    : 0

  return (
    <>
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

      {editing ? (
        <CarForm
          // Remount when switching cars so the form resets to that car.
          key={editing === 'new' ? 'new' : editing.id}
          car={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={(saved) => {
            upsert(saved)
            setEditing(null)
          }}
        />
      ) : (
        <div className="panel-toolbar">
          <button type="button" className="btn" onClick={() => setEditing('new')}>
            + Add car
          </button>
        </div>
      )}

      {saveError && (
        <p className="form-error" role="alert">
          {saveError.message}
        </p>
      )}

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
                  {car.make} {car.model} <span className="faint">{car.year}</span>
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
                    disabled={savingId === car.id}
                    onClick={() => toggleActive(car)}
                  />
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setEditing(car)}
                    >
                      Edit
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
