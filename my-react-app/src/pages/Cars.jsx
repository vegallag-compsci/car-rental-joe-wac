import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getCars } from '../api/cars'
import CarCard from '../components/CarCard'
import CarGridSkeleton from '../components/CarGridSkeleton'
import { CloseIcon, FiltersIcon } from '../components/icons'
import LoadState from '../components/LoadState'
import { useAsync } from '../hooks/useAsync'
import { useCategories } from '../hooks/useCategories'
import { useOverlay } from '../hooks/useOverlay'
import { daysBetween, formatDate } from '../utils/format'

export default function Cars() {
  // Filters live in the URL so links like /cars?category=3 just work, and so a
  // filtered view can be shared or bookmarked. The params map 1:1 onto the API.
  const [searchParams, setSearchParams] = useSearchParams()
  const { categories } = useCategories()

  // Below 1024px the filters open as a bottom sheet; on wider screens they're
  // a sidebar and this state has no visible effect.
  const [filtersOpen, setFiltersOpen] = useState(false)
  const closeFilters = useCallback(() => setFiltersOpen(false), [])
  const { triggerRef, panelRef } = useOverlay(filtersOpen, closeFilters)

  const pickup = searchParams.get('pickup') ?? ''
  const dropoff = searchParams.get('return') ?? ''
  const categoryId = searchParams.get('category') ?? 'all'
  const sort = searchParams.get('sort') ?? 'default'

  // The API only filters by availability when it gets a valid date range, and
  // rejects a backwards one, so only send dates once both make sense.
  const hasDates = daysBetween(pickup, dropoff) > 0
  const datesInvalid = Boolean(pickup && dropoff && !hasDates)

  const { loading, data: cars, error, reload } = useAsync(
    (signal) =>
      getCars({
        categoryId,
        sort: sort === 'default' ? undefined : sort,
        pickup: hasDates ? pickup : undefined,
        dropoff: hasDates ? dropoff : undefined,
        signal,
      }),
    [categoryId, sort, hasDates, pickup, dropoff]
  )

  function updateParam(key, value) {
    const next = new URLSearchParams(searchParams)
    if (value) {
      next.set(key, value)
    } else {
      next.delete(key)
    }
    setSearchParams(next)
  }

  // Carry the searched dates through to the details page.
  const detailSearch = hasDates ? `?pickup=${pickup}&return=${dropoff}` : ''

  return (
    <div className="page">
      <div className="page-header">
        <h1>Find a car</h1>
        <p>
          {hasDates
            ? `Showing cars free from ${formatDate(pickup)} to ${formatDate(dropoff)}.`
            : 'Add your dates to see only the cars free for your trip.'}
        </p>
      </div>

      <div className="cars-layout">
        <aside
          id="car-filters"
          ref={panelRef}
          tabIndex={-1}
          className="filter-panel glass"
          data-open={filtersOpen}
          aria-labelledby="car-filters-title"
        >
          <div className="filter-panel-head">
            <h2 id="car-filters-title">Filters</h2>
            <button type="button" className="icon-btn" aria-label="Close filters" onClick={closeFilters}>
              <CloseIcon />
            </button>
          </div>

          <div className="filter-fields">
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
                {categories.map((category) => (
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
                <option value="newest">Newest</option>
              </select>
            </div>
          </div>

          {/* Filters apply as they change; this only closes the sheet. */}
          <button type="button" className="btn btn-block filter-done" onClick={closeFilters}>
            Show results
          </button>
        </aside>

        <div className="scrim filter-scrim" data-open={filtersOpen} aria-hidden="true" onClick={closeFilters} />

        <section aria-label="Results">
          <div className="results-bar">
            {!loading && !error && (
              <p className="results-count">
                {cars.length} {cars.length === 1 ? 'car' : 'cars'} available
              </p>
            )}
            <button
              ref={triggerRef}
              type="button"
              className="btn btn-secondary filter-open"
              aria-expanded={filtersOpen}
              aria-controls="car-filters"
              onClick={() => setFiltersOpen(true)}
            >
              <FiltersIcon />
              Filters
            </button>
          </div>

          {datesInvalid && (
            <p className="form-error">
              Return date must be after the pickup date. Showing all cars instead.
            </p>
          )}

          <CarResults
            loading={loading}
            error={error}
            cars={cars}
            onRetry={reload}
            detailSearch={detailSearch}
          />
        </section>
      </div>
    </div>
  )
}

// Skeleton, error, empty message or the grid, depending on the request.
function CarResults({ loading, error, cars, onRetry, detailSearch }) {
  if (loading) return <CarGridSkeleton />
  if (error) return <LoadState error={error} onRetry={onRetry} />

  if (cars.length === 0) {
    return (
      <div className="empty-state glass">
        No cars match those filters. Try different dates or another category.
      </div>
    )
  }

  return (
    <div className="car-grid">
      {cars.map((car) => (
        <CarCard key={car.id} car={car} search={detailSearch} />
      ))}
    </div>
  )
}
