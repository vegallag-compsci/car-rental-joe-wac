// Placeholder shown while a useAsync request is in flight or has failed.
// Pages render it in place of their content:
//
//   if (loading || error) return <LoadState loading={loading} error={error} onRetry={reload} />
export default function LoadState({ loading, error, onRetry, loadingText = 'Loading…' }) {
  if (loading) {
    return (
      <div className="empty-state glass" role="status">
        {loadingText}
      </div>
    )
  }

  return (
    <div className="empty-state glass" role="alert">
      <p>{error?.message || 'Something went wrong.'}</p>
      {onRetry && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry} style={{ marginTop: 16 }}>
          Try again
        </button>
      )}
    </div>
  )
}
