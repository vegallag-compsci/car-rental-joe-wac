import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="page">
      <div className="empty-state glass">
        <h1>Page not found</h1>
        <p>That route doesn&apos;t exist yet.</p>
        <Link to="/" className="btn">
          Go home
        </Link>
      </div>
    </div>
  )
}
