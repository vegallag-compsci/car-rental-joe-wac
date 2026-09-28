import { Link } from 'react-router-dom'
import SearchBar from '../components/SearchBar'
import { carCategories, cars } from '../data/mockCars'

const steps = [
  { title: 'Choose dates', text: 'Tell us when you need the car and for how long.' },
  { title: 'Pick a car', text: 'Browse the fleet and compare daily rates.' },
  { title: 'Drive', text: 'Pick up the keys and go. No paperwork queue.' },
]

// Cheapest daily rate in a category, shown on the tiles as a "from" price.
function startingRate(categoryId) {
  const rates = cars
    .filter((car) => car.category_id === categoryId && car.is_active)
    .map((car) => car.daily_rate)
  return rates.length ? Math.min(...rates) : null
}

export default function Home() {
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
            {carCategories.map((category) => {
              const rate = startingRate(category.id)
              return (
                <Link
                  key={category.id}
                  to={`/cars?category=${category.id}`}
                  className="category-tile glass"
                >
                  <strong>{category.name}</strong>
                  <span>{rate ? `from $${rate} / day` : 'Coming soon'}</span>
                </Link>
              )
            })}
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
