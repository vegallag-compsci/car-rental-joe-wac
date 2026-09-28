import { useSearchParams } from 'react-router-dom'
import CarCard from '../components/CarCard'
import { carCategories, cars } from '../data/mockCars'

export default function Cars() {
  // Filters live in the URL so links like /cars?category=3 just work, and so a
  // filtered view can be shared or bookmarked.
  const [searchParams, setSearchParams] = useSearchParams()

  const pickup = searchParams.get('pickup') ?? ''
  const dropoff = searchParams.get('return') ?? ''
  const categoryId = searchParams.get('category') ?? 'all'
  const sort = searchParams.get('sort') ?? 'default'

  function updateParam(key, value) {
    const next = new URLSearchParams(searchParams)
    if (value) {
      next.set(key, value)
    } else {
      next.delete(key)
    }
    setSearchParams(next)
  }

  // Only show cars the admin has marked active.
  let visibleCars = cars.filter((car) => car.is_active)

  if (categoryId !== 'all') {
    visibleCars = visibleCars.filter(
      (car) => car.category_id === Number(categoryId)
    )
  }

  if (sort === 'price-asc') {
    visibleCars = [...visibleCars].sort((a, b) => a.daily_rate - b.daily_rate)
  } else if (sort === 'price-desc') {
    visibleCars = [...visibleCars].sort((a, b) => b.daily_rate - a.daily_rate)
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Find a car</h1>
        <p>Every car below is available to book today.</p>
      </div>

      <div className="filter-bar glass">
        <div className="field">
          <label htmlFor="filter-pickup">Pickup date</label>
          <input
            id="filter-pickup"
            type="date"
            value={pickup}
            onChange={(e) => updateParam('pickup', e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="filter-return">Return date</label>
          <input
            id="filter-return"
            type="date"
            value={dropoff}
            min={pickup || undefined}
            onChange={(e) => updateParam('return', e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="filter-category">Category</label>
          <select
            id="filter-category"
            value={categoryId}
            onChange={(e) =>
              updateParam(
                'category',
                e.target.value === 'all' ? '' : e.target.value
              )
            }
          >
            <option value="all">All categories</option>
            {carCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="filter-sort">Sort by</label>
          <select
            id="filter-sort"
            value={sort}
            onChange={(e) =>
              updateParam(
                'sort',
                e.target.value === 'default' ? '' : e.target.value
              )
            }
          >
            <option value="default">Recommended</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
          </select>
        </div>
      </div>

      <p className="results-count">
        {visibleCars.length} {visibleCars.length === 1 ? 'car' : 'cars'} available
      </p>

      {visibleCars.length > 0 ? (
        <div className="car-grid">
          {visibleCars.map((car) => (
            <CarCard key={car.id} car={car} />
          ))}
        </div>
      ) : (
        <div className="empty-state glass">
          No cars match those filters. Try a different category.
        </div>
      )}
    </div>
  )
}
