// Five stars with `rating` of them filled. Screen readers hear
// "4 out of 5 stars" instead of five separate symbols.
export default function StarRating({ rating }) {
  // Keep a typo in the data (like 6 or 0) from breaking the layout.
  const filled = Math.min(5, Math.max(0, Math.round(Number(rating) || 0)))

  return (
    <span className="stars" role="img" aria-label={`${filled} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= filled ? 'star star-on' : 'star'} aria-hidden="true">
          ★
        </span>
      ))}
    </span>
  )
}
