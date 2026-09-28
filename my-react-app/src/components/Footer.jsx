import { Link } from 'react-router-dom'

// Read once at module load rather than on every render.
const year = new Date().getFullYear()

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <span>© {year} CarRental — student project</span>
        <div className="footer-links">
          <Link to="/cars">Find a car</Link>
          <Link to="/bookings">My bookings</Link>
          <Link to="/admin">Admin</Link>
        </div>
      </div>
    </footer>
  )
}
