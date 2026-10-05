import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import LoadState from '../components/LoadState'
import BookingsPanel from './admin/BookingsPanel'
import FleetPanel from './admin/FleetPanel'
import UsersPanel from './admin/UsersPanel'

const TABS = [
  { id: 'fleet', label: 'Fleet', Panel: FleetPanel },
  { id: 'bookings', label: 'Bookings', Panel: BookingsPanel },
  { id: 'users', label: 'Users', Panel: UsersPanel },
]

export default function Admin() {
  const { status, user } = useAuth()
  // The open tab lives in the URL (/admin?tab=bookings) so it survives a
  // refresh and can be linked to.
  const [searchParams, setSearchParams] = useSearchParams()
  const active = TABS.find((tab) => tab.id === searchParams.get('tab')) ?? TABS[0]

  if (status === 'loading') {
    return (
      <div className="page">
        <LoadState loading />
      </div>
    )
  }

  // Hiding the page is for the user's benefit only; the API and RLS are
  // what actually refuse non-admins.
  if (user?.role !== 'admin') {
    return (
      <div className="page">
        <div className="empty-state glass">This page is for admins only.</div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Admin</h1>
        <p>Manage the fleet, approve bookings, and control who has admin access.</p>
      </div>

      <div className="tabs" role="tablist" aria-label="Admin sections">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={tab.id === active.id}
            aria-controls="admin-panel"
            className="tab"
            onClick={() => setSearchParams(tab.id === 'fleet' ? {} : { tab: tab.id })}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <section id="admin-panel" role="tabpanel" aria-labelledby={`tab-${active.id}`}>
        <active.Panel />
      </section>
    </div>
  )
}
