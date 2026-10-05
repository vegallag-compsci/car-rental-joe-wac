import { Link } from 'react-router-dom'
import { getCars } from '../api/cars'
import SearchBar from '../components/SearchBar'
import { useAsync } from '../hooks/useAsync'
import { useCategories } from '../hooks/useCategories'
import { formatMoney } from '../utils/format'

const steps = [
  { title: 'Choose dates', text: 'Tell us when you need the car and for how long.' },
  { title: 'Pick a car', text: 'Browse the fleet and compare daily rates.' },
  { title: 'Drive', text: 'Pick up the keys and go. No paperwork queue.' },
]

// Cheapest daily rate in each category, shown on the tiles as a "from" price.
// The API only returns active cars, so no is_active check is needed here.
function startingRates(cars) {
  const rates = new Map()
  for (const car of cars) {
    const current = rates.get(car.category_id)
    if (current === undefined || car.daily_rate < current) {
      rates.set(car.category_id, car.daily_rate)
    }
  }
  return rates
}

export default function Home() {
  const { categories } = useCategories()
  const { data: cars } = useAsync((signal) => getCars({ signal }), [])
  const rates = startingRates(cars ?? [])

  function tileText(categoryId) {
    if (!cars) return ' ' // keep the tile height steady while loading
    const rate = rates.get(categoryId)
    return rate === undefined ? 'Coming soon' : `from ${formatMoney(rate)} / day`
  }

  return (
    <>
      <section className="hero">
        <h1>Rent a car without the hassle.</h1>
        <p className="hero-tagline">
          A small, well-kept fleet. Transparent daily rates. Book in under a
          minute and pick up whenever suits you.
        </p>
        <SearchBar />
      </section>

      <div className="page">
        <section className="section">
          <h2 className="section-title">Browse by category</h2>
          <div className="category-row">
            {categories.map((category) => (
              <Link
                key={category.id}
                to={`/cars?category=${category.id}`}
                className="category-tile glass"
              >
                <strong>{category.name}</strong>
                <span>{tileText(category.id)}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="section">
          <h2 className="section-title">How it works</h2>
          <div className="steps">
            {steps.map((step, index) => (
              <div key={step.title} className="step glass">
                <div className="step-number">{index + 1}</div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}
