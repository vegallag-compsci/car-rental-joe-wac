import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCategories } from '../hooks/useCategories'

// Home page search. Submitting sends the chosen values to /cars as query
// params, which the Browse page reads to pre-fill its own filter bar.
export default function SearchBar() {
  const navigate = useNavigate()
  const { categories } = useCategories()
  const [pickup, setPickup] = useState('')
  const [dropoff, setDropoff] = useState('')
  const [categoryId, setCategoryId] = useState('all')

  function handleSubmit(event) {
    event.preventDefault()

    const params = new URLSearchParams()
    if (pickup) params.set('pickup', pickup)
    if (dropoff) params.set('return', dropoff)
    if (categoryId !== 'all') params.set('category', categoryId)

    navigate(`/cars?${params.toString()}`)
  }

  return (
    <form className="search-bar glass glass-medium" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="search-pickup">Pickup date</label>
        <input
          id="search-pickup"
          type="date"
          value={pickup}
          onChange={(e) => setPickup(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="search-return">Return date</label>
        <input
          id="search-return"
          type="date"
          value={dropoff}
          min={pickup || undefined}
          onChange={(e) => setDropoff(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="search-category">Category</label>
        <select
          id="search-category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="all">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <button type="submit" className="btn">
        Search
      </button>
    </form>
  )
}
