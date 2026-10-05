import { useState } from 'react'
import { createCar, updateCar } from '../../api/admin'
import { useCategories } from '../../hooks/useCategories'

// Add or edit a car. The input limits mirror api/app/validation.py so most
// mistakes are caught before sending, but the API (and the database's CHECK
// constraints) are the real rules; any error they return is shown as-is.

const NEW_CAR = {
  make: '',
  model: '',
  year: String(new Date().getFullYear()),
  color: '',
  category_id: '',
  seats: '5',
  transmission: 'automatic',
  mileage: '0',
  daily_rate: '',
  image_url: '',
}

// Inputs hold strings; the API wants numbers.
function toForm(car) {
  return {
    make: car.make,
    model: car.model,
    year: String(car.year),
    color: car.color,
    category_id: String(car.category_id),
    seats: String(car.seats),
    // Legacy 'AutoManual' rows can't be saved back as-is, so make the admin
    // pick a real value.
    transmission: ['automatic', 'manual'].includes(car.transmission) ? car.transmission : '',
    mileage: String(car.mileage),
    daily_rate: String(car.daily_rate),
    image_url: car.image_url ?? '',
  }
}

function toPayload(form) {
  return {
    make: form.make.trim(),
    model: form.model.trim(),
    year: Number(form.year),
    color: form.color.trim(),
    category_id: Number(form.category_id),
    seats: Number(form.seats),
    transmission: form.transmission,
    mileage: Number(form.mileage),
    daily_rate: Number(form.daily_rate),
    image_url: form.image_url.trim() || null,
  }
}

/** `car` is null to add a new one. New cars start inactive so they can be
 *  checked before customers see them. */
export default function CarForm({ car, onSaved, onCancel }) {
  const { categories } = useCategories()
  const [form, setForm] = useState(() => (car ? toForm(car) : NEW_CAR))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function field(name) {
    return {
      id: `car-${name}`,
      name,
      value: form[name],
      onChange: (e) => setForm((current) => ({ ...current, [name]: e.target.value })),
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const payload = toPayload(form)
      const saved = car
        ? await updateCar(car.id, payload)
        : await createCar({ ...payload, is_active: false })
      onSaved(saved)
    } catch (err) {
      setError(err)
      setSaving(false)
    }
  }

  return (
    <form className="admin-form glass" onSubmit={handleSubmit}>
      <h2 className="admin-form-title">
        {car ? `Edit ${car.make} ${car.model}` : 'Add a car'}
      </h2>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="car-make">Make</label>
          <input {...field('make')} required maxLength={60} />
        </div>
        <div className="field">
          <label htmlFor="car-model">Model</label>
          <input {...field('model')} required maxLength={60} />
        </div>
        <div className="field">
          <label htmlFor="car-year">Year</label>
          <input {...field('year')} type="number" required min={1980} max={2100} step={1} />
        </div>

        <div className="field">
          <label htmlFor="car-category_id">Category</label>
          <select {...field('category_id')} required>
            <option value="" disabled>
              Choose…
            </option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="car-color">Color</label>
          <input {...field('color')} required maxLength={30} />
        </div>
        <div className="field">
          <label htmlFor="car-transmission">Transmission</label>
          <select {...field('transmission')} required>
            <option value="" disabled>
              Choose…
            </option>
            <option value="automatic">Automatic</option>
            <option value="manual">Manual</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="car-seats">Seats</label>
          <input {...field('seats')} type="number" required min={1} max={50} step={1} />
        </div>
        <div className="field">
          <label htmlFor="car-mileage">Mileage</label>
          <input {...field('mileage')} type="number" required min={0} max={2000000} step={1} />
        </div>
        <div className="field">
          <label htmlFor="car-daily_rate">Daily rate ($)</label>
          <input {...field('daily_rate')} type="number" required min={0.01} max={99999} step={0.01} />
        </div>

        <div className="field form-grid-wide">
          <label htmlFor="car-image_url">Image URL (optional)</label>
          <input {...field('image_url')} type="url" maxLength={2000} placeholder="https://…" />
        </div>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error.message}
        </p>
      )}

      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="btn" disabled={saving}>
          {saving ? 'Saving…' : car ? 'Save changes' : 'Add car'}
        </button>
      </div>

      {!car && (
        <p className="form-hint">
          New cars start inactive. Switch them on in the table when they&apos;re ready to book.
        </p>
      )}
    </form>
  )
}
