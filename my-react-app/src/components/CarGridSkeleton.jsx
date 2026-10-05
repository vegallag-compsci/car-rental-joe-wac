// Stand-in for the car grid while /cars loads. Shaped like real CarCards so
// the layout doesn't jump when they arrive.
export default function CarGridSkeleton({ count = 6, label = 'Loading cars…' }) {
  return (
    <div className="car-grid" role="status">
      <span className="visually-hidden">{label}</span>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="car-card glass" aria-hidden="true">
          <span className="car-card-image skeleton" />
          <div className="car-card-body skeleton-text">
            <span className="skeleton skeleton-line" />
            <span className="skeleton skeleton-line" />
            <span className="skeleton skeleton-line" />
          </div>
        </div>
      ))}
    </div>
  )
}
