import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getAdminBookings, setBookingStatus } from '../../api/admin'
import ConfirmButton from '../../components/ConfirmButton'
import LoadState from '../../components/LoadState'
import StatusBadge from '../../components/StatusBadge'
import { useAsync } from '../../hooks/useAsync'
import { daysBetween, formatDate, formatMoney, getCarLabel } from '../../utils/format'

// The booking lifecycle, as buttons. The API accepts any status, but
// offering only the sensible next steps keeps mistakes rare. Steps that
// take a car away from a customer ask for confirmation first.
const NEXT_STEPS = {
  pending: [
    { to: 'confirmed', label: 'Approve' },
    { to: 'cancelled', label: 'Decline', confirm: 'Yes, decline' },
  ],
  confirmed: [
    { to: 'active', label: 'Picked up' },
    { to: 'cancelled', label: 'Cancel', confirm: 'Yes, cancel' },
  ],
  active: [{ to: 'returned', label: 'Returned' }],
  returned: [],
  // Fails with a clear 409 if someone else has booked those dates since.
  cancelled: [{ to: 'pending', label: 'Reopen' }],
}

const FILTERS = [
  { id: 'pending', label: 'Needs approval' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'active', label: 'Out now' },
  { id: 'returned', label: 'Returned' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'all', label: 'All' },
]

export default function BookingsPanel() {
  // All bookings load once so every filter can show its count; the filter
  // itself is in the URL (?tab=bookings&status=confirmed).
  const { loading, data: bookings, error, reload, setData } = useAsync(
    (signal) => getAdminBookings({ signal }),
    []
  )
  const [searchParams, setSearchParams] = useSearchParams()
  const filter = FILTERS.find((f) => f.id === searchParams.get('status'))?.id ?? 'pending'
  const [savingId, setSavingId] = useState(null)
  const [saveError, setSaveError] = useState(null)

  function chooseFilter(id) {
    const next = new URLSearchParams(searchParams)
    next.set('status', id)
    setSearchParams(next)
  }

  async function moveTo(booking, status) {
    setSavingId(booking.id)
    setSaveError(null)
    try {
      const updated = await setBookingStatus(booking.id, status)
      // The response has no embedded car or email, so merge, don't replace.
      setData((current) =>
        current.map((b) => (b.id === booking.id ? { ...b, ...updated } : b))
      )
    } catch (err) {
      setSaveError({ bookingId: booking.id, message: err.message })
    } finally {
      setSavingId(null)
    }
  }

  if (loading || error) {
    return <LoadState loading={loading} error={error} onRetry={reload} loadingText="Loading bookings…" />
  }

  const countFor = (id) =>
    id === 'all' ? bookings.length : bookings.filter((b) => b.status === id).length
  const visible = filter === 'all' ? bookings : bookings.filter((b) => b.status === filter)

  return (
    <>
      <div className="chip-row" role="group" aria-label="Filter bookings by status">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className="chip"
            aria-pressed={f.id === filter}
            onClick={() => chooseFilter(f.id)}
          >
            {f.label} <span className="chip-count">{countFor(f.id)}</span>
          </button>
        ))}
      </div>

      {saveError && (
        <p className="form-error" role="alert">
          Booking #{saveError.bookingId}: {saveError.message}
        </p>
      )}

      {visible.length === 0 ? (
        <div className="empty-state glass">No bookings here.</div>
      ) : (
        <div className="table-wrap glass">
          <table className="table-stack">
            <thead>
              <tr>
                <th>#</th>
                <th>Car</th>
                <th>Customer</th>
                <th>Dates</th>
                <th>Total</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {visible.map((booking) => {
                const nights = daysBetween(booking.pickup_at, booking.return_at)
                const busy = savingId === booking.id
                return (
                  <tr key={booking.id}>
                    <td data-label="#" className="faint">{booking.id}</td>
                    <td data-label="Car">{getCarLabel(booking.car)}</td>
                    <td data-label="Customer">
                      {booking.customer_email ?? <span className="faint">No owner</span>}
                    </td>
                    <td data-label="Dates">
                      {/* One wrapper so the stacked phone layout keeps dates and nights together. */}
                      <span>
                        {formatDate(booking.pickup_at)} → {formatDate(booking.return_at)}{' '}
                        <span className="faint">
                          · {nights} {nights === 1 ? 'night' : 'nights'}
                        </span>
                      </span>
                    </td>
                    <td data-label="Total">{formatMoney(booking.total_price)}</td>
                    <td data-label="Status">
                      <StatusBadge status={booking.status} />
                    </td>
                    <td>
                      <div className="row-actions">
                        {(NEXT_STEPS[booking.status] ?? []).map((step) =>
                          step.confirm ? (
                            <ConfirmButton
                              key={step.to}
                              confirmLabel={step.confirm}
                              disabled={busy}
                              onConfirm={() => moveTo(booking, step.to)}
                            >
                              {step.label}
                            </ConfirmButton>
                          ) : (
                            <button
                              key={step.to}
                              type="button"
                              className={step.to === 'confirmed' ? 'btn btn-sm' : 'btn btn-secondary btn-sm'}
                              disabled={busy}
                              onClick={() => moveTo(booking, step.to)}
                            >
                              {step.label}
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
