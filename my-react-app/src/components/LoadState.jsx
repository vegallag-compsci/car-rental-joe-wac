// Placeholder shown while a useAsync request is in flight or has failed.
// Pages render it in place of their content:
//
//   if (loading || error) return <LoadState loading={loading} error={error} onRetry={reload} />
//
// While loading it shows shimmering skeleton lines; screen readers hear
// `loadingText` instead.
export default function LoadState({ loading, error, onRetry, loadingText = 'Loading…' }) {
  if (loading) {
    return (
      <div className="load-state glass" role="status">
        <span className="visually-hidden">{loadingText}</span>
        <div className="skeleton-text" aria-hidden="true">
          <span className="skeleton skeleton-line" />
          <span className="skeleton skeleton-line" />
          <span className="skeleton skeleton-line" />
        </div>
      </div>
    )
  }

  return (
    <div className="empty-state glass" role="alert">
      <p>{error?.message || 'Something went wrong.'}</p>
      {onRetry && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}
