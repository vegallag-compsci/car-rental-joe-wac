import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="page">
      <div className="empty-state glass">
        <h1 style={{ fontSize: '1.5rem', marginBottom: 8 }}>Page not found</h1>
        <p>That route doesn&apos;t exist yet.</p>
        <Link to="/" className="btn" style={{ marginTop: 16 }}>
          Go home
        </Link>
      </div>
    </div>
  )
}
