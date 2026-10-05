import { useSearchParams } from 'react-router-dom'
import Avatar from '../components/Avatar'
import StarRating from '../components/StarRating'
import { REVIEWS_NOTE, reviews } from '../data/reviews'
import { formatDate } from '../utils/format'

// Review content lives in src/data/reviews.js; this file is only layout.

const SORTS = {
  newest: { label: 'Newest', compare: (a, b) => b.date.localeCompare(a.date) },
  highest: { label: 'Highest rated', compare: (a, b) => b.rating - a.rating || b.date.localeCompare(a.date) },
  lowest: { label: 'Lowest rated', compare: (a, b) => a.rating - b.rating || b.date.localeCompare(a.date) },
}

export default function Reviews() {
  // Sort lives in the URL (/reviews?sort=highest), like the /cars filters.
  const [searchParams, setSearchParams] = useSearchParams()
  const sortKey = searchParams.get('sort') in SORTS ? searchParams.get('sort') : 'newest'
  const sorted = [...reviews].sort(SORTS[sortKey].compare)

  const average = reviews.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0
  const countFor = (stars) => reviews.filter((r) => r.rating === stars).length

  return (
    <div className="page">
      <div className="page-header">
        <h1>Customer reviews</h1>
        <p>What renters say about their trips.</p>
        {REVIEWS_NOTE && <p className="faint reviews-note">{REVIEWS_NOTE}</p>}
      </div>

      {reviews.length === 0 ? (
        <div className="empty-state glass">No reviews yet.</div>
      ) : (
        <>
          <section className="review-summary glass" aria-label="Rating summary">
            <div className="review-summary-score">
              <strong>{average.toFixed(1)}</strong>
              <StarRating rating={average} />
              <span className="faint">
                {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
              </span>
            </div>

            <dl className="review-bars">
              {[5, 4, 3, 2, 1].map((stars) => {
                const count = countFor(stars)
                return (
                  <div key={stars} className="review-bar">
                    <dt>{stars} star</dt>
                    <dd>
                      <span className="review-bar-track" aria-hidden="true">
                        <span
                          className="review-bar-fill"
                          style={{ width: `${(count / reviews.length) * 100}%` }}
                        />
                      </span>
                      <span className="review-bar-count">{count}</span>
                    </dd>
                  </div>
                )
              })}
            </dl>
          </section>

          <div className="review-toolbar">
            <div className="field">
              <label htmlFor="review-sort">Sort by</label>
              <select
                id="review-sort"
                value={sortKey}
                onChange={(e) =>
                  setSearchParams(e.target.value === 'newest' ? {} : { sort: e.target.value })
                }
              >
                {Object.entries(SORTS).map(([key, sort]) => (
                  <option key={key} value={key}>
                    {sort.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="review-grid">
            {sorted.map((review) => (
              <article key={review.id} className="review-card glass">
                <header className="review-card-head">
                  <Avatar src={review.avatar_url} name={review.name} size="lg" />
                  <div>
                    <h3>{review.name}</h3>
                    <time className="faint" dateTime={review.date}>
                      {formatDate(review.date)}
                    </time>
                  </div>
                </header>

                <StarRating rating={review.rating} />
                <h4 className="review-title">{review.title}</h4>
                <p className="review-body">{review.body}</p>
                {review.car && <p className="faint review-car">Rented: {review.car}</p>}
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
