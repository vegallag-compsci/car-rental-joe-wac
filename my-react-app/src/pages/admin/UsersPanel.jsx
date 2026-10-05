import { useState } from 'react'
import { searchUsers, setUserRole } from '../../api/admin'
import { useAuth } from '../../auth/AuthContext'
import ConfirmButton from '../../components/ConfirmButton'
import LoadState from '../../components/LoadState'
import RoleBadge from '../../components/RoleBadge'
import { useAsync } from '../../hooks/useAsync'
import { formatDate } from '../../utils/format'

// Matches USER_SEARCH_LIMIT in api/app/queries.py.
const SEARCH_LIMIT = 25

// Accounts are created by signing in with Google, so a person must have
// logged in once before they show up here.
export default function UsersPanel() {
  const { user: me } = useAuth()
  const [draft, setDraft] = useState('')
  // Only search on submit, not on every keystroke.
  const [email, setEmail] = useState('')
  const { loading, data: users, error, reload, setData } = useAsync(
    (signal) => searchUsers({ email, signal }),
    [email]
  )
  const [savingId, setSavingId] = useState(null)
  const [saveError, setSaveError] = useState(null)

  function handleSearch(event) {
    event.preventDefault()
    setSaveError(null)
    setEmail(draft.trim())
  }

  async function changeRole(user, role) {
    setSavingId(user.id)
    setSaveError(null)
    try {
      const updated = await setUserRole(user.id, role)
      setData((current) => current.map((u) => (u.id === user.id ? { ...u, ...updated } : u)))
    } catch (err) {
      setSaveError(err)
    } finally {
      setSavingId(null)
    }
  }

  return (
    <>
      <form className="search-row glass" onSubmit={handleSearch} role="search">
        <div className="field">
          <label htmlFor="user-search">Customer email</label>
          <input
            id="user-search"
            type="search"
            value={draft}
            maxLength={254}
            placeholder="Part of an email, e.g. jane@ or syr.edu"
            onChange={(e) => setDraft(e.target.value)}
          />
        </div>
        <button type="submit" className="btn">
          Search
        </button>
      </form>

      {saveError && (
        <p className="form-error" role="alert">
          {saveError.message}
        </p>
      )}

      {loading || error ? (
        <LoadState loading={loading} error={error} onRetry={reload} loadingText="Searching…" />
      ) : users.length === 0 ? (
        <div className="empty-state glass">
          {email
            ? `No account found matching "${email}". They need to sign in with Google once first.`
            : 'No accounts yet.'}
        </div>
      ) : (
        <>
          <p className="results-count">
            {email ? `Accounts matching "${email}"` : 'All accounts'}
            {users.length === SEARCH_LIMIT &&
              ` (first ${SEARCH_LIMIT}, refine the search to narrow it down)`}
          </p>

          <div className="table-wrap glass">
            <table className="table-stack">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td data-label="Email">{user.email}</td>
                    <td data-label="Role">
                      <RoleBadge role={user.role} />
                    </td>
                    <td data-label="Joined" className="faint">
                      {formatDate(user.created_at)}
                    </td>
                    <td>
                      <div className="row-actions">
                        {user.id === me.id ? (
                          // The API refuses this too; it keeps the last
                          // admin from locking everyone out.
                          <span className="faint">You</span>
                        ) : user.role === 'admin' ? (
                          <ConfirmButton
                            confirmLabel="Yes, remove admin"
                            disabled={savingId === user.id}
                            onConfirm={() => changeRole(user, 'customer')}
                          >
                            Remove admin
                          </ConfirmButton>
                        ) : (
                          <ConfirmButton
                            confirmLabel="Yes, make admin"
                            disabled={savingId === user.id}
                            onConfirm={() => changeRole(user, 'admin')}
                          >
                            Make admin
                          </ConfirmButton>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}
