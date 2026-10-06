import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getAuditLog } from '../../api/admin'
import LoadState from '../../components/LoadState'
import { useAsync } from '../../hooks/useAsync'
import { formatDate, formatDateTime, getCarLabel } from '../../utils/format'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'booking', label: 'Bookings' },
  { id: 'car', label: 'Fleet' },
  { id: 'user', label: 'Users' },
  { id: 'category', label: 'Categories' },
]

const TARGET_LABELS = { car: 'Car', category: 'Category', booking: 'Booking', user: 'User' }

// The second half of an action name ('car.deactivated' -> 'deactivated').
// Actions are named by the trigger in supabase/004_audit_log.sql.
const VERBS = {
  created: 'Created',
  updated: 'Edited',
  deleted: 'Deleted',
  activated: 'Reactivated',
  deactivated: 'Deactivated',
  status_changed: 'Changed status of',
  role_changed: 'Changed role of',
}

function actionLabel(entry) {
  const verb = VERBS[entry.action.split('.')[1]]
  return verb ? `${verb} ${entry.target_type}` : entry.action
}

function targetLabel(entry) {
  if (entry.target_type === 'user') return entry.target_email ?? 'Deleted user'
  return `${TARGET_LABELS[entry.target_type] ?? entry.target_type} #${entry.target_id}`
}

// A one-line description of a created or deleted row.
function rowSummary(type, row) {
  switch (type) {
    case 'car':
      return getCarLabel(row)
    case 'booking':
      return `Car #${row.car_id}, ${formatDate(row.pickup_at)} → ${formatDate(row.return_at)}`
    case 'category':
      return row.name
    case 'user':
      return row.email ?? '—'
    default:
      return '—'
  }
}

function showValue(value) {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function Details({ entry }) {
  const { changes, row } = entry.metadata

  if (changes) {
    return (
      <ul className="audit-changes">
        {Object.entries(changes).map(([column, { from, to }]) => (
          <li key={column}>
            <span className="faint">{column}</span> {showValue(from)} → {showValue(to)}
          </li>
        ))}
      </ul>
    )
  }
  return row ? rowSummary(entry.target_type, row) : '—'
}

function Actor({ entry }) {
  if (entry.actor_email) return entry.actor_email
  // No actor means no logged-in user made the change (source 'database').
  return (
    <span className="faint">
      {entry.actor_id ? 'Deleted user' : 'SQL Editor / service key'}
    </span>
  )
}

export default function AuditPanel() {
  // The filter is in the URL (?tab=audit&type=car) like the bookings filter.
  const [searchParams, setSearchParams] = useSearchParams()
  const filter = FILTERS.find((f) => f.id === searchParams.get('type'))?.id ?? 'all'

  const { loading, data, error, reload, setData } = useAsync(
    (signal) => getAuditLog({ type: filter, signal }),
    [filter]
  )
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState(null)

  function chooseFilter(id) {
    const next = new URLSearchParams(searchParams)
    next.set('type', id)
    setSearchParams(next)
  }

  async function loadMore() {
    setLoadingMore(true)
    setMoreError(null)
    try {
      const page = await getAuditLog({ type: filter, before: data.entries.at(-1).id })
      setData((current) => ({
        entries: [...current.entries, ...page.entries],
        has_more: page.has_more,
      }))
    } catch (err) {
      setMoreError(err)
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <>
      <p className="panel-intro">
        Every change an admin makes, newest first. The database records it, so
        changes made outside this site (for example in the Supabase SQL
        Editor) appear here too. IP addresses are a lead, not proof.
      </p>

      {/* Locked while a page is loading, so it can't land under another filter. */}
      <div className="chip-row" role="group" aria-label="Filter the audit log">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className="chip"
            aria-pressed={f.id === filter}
            disabled={loadingMore}
            onClick={() => chooseFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading || error ? (
        <LoadState loading={loading} error={error} onRetry={reload} loadingText="Loading audit log…" />
      ) : data.entries.length === 0 ? (
        <div className="empty-state glass">Nothing has been logged here yet.</div>
      ) : (
        <>
          <div className="table-wrap glass">
            <table className="table-stack">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Admin</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Details</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((entry) => (
                  <tr key={entry.id}>
                    <td data-label="When">{formatDateTime(entry.created_at)}</td>
                    <td data-label="Admin"><Actor entry={entry} /></td>
                    <td data-label="Action">{actionLabel(entry)}</td>
                    <td data-label="Target">{targetLabel(entry)}</td>
                    <td data-label="Details" className="audit-details">
                      <Details entry={entry} />
                    </td>
                    <td data-label="IP" className="faint">{entry.ip_address ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {moreError && (
            <p className="form-error" role="alert">{moreError.message}</p>
          )}

          {data.has_more && (
            <div className="load-more">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={loadingMore}
                onClick={loadMore}
              >
                {loadingMore ? 'Loading…' : 'Load older entries'}
              </button>
            </div>
          )}
        </>
      )}
    </>
  )
}
