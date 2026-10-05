import { Route, Routes } from 'react-router-dom'
import Nav from './components/Nav'
import Footer from './components/Footer'
import ScrollToTop from './components/ScrollToTop'
import Home from './pages/Home'
import Cars from './pages/Cars'
import CarDetails from './pages/CarDetails'
import Bookings from './pages/Bookings'
import Reviews from './pages/Reviews'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import Admin from './pages/Admin'
import NotFound from './pages/NotFound'
import { AUTH_CALLBACK_PATH } from './auth/session'

export default function App() {
  return (
    <div className="app-shell">
      <ScrollToTop />
      <Nav />

      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/cars" element={<Cars />} />
          <Route path="/cars/:id" element={<CarDetails />} />
          <Route path="/bookings" element={<Bookings />} />
          <Route path="/reviews" element={<Reviews />} />
          <Route path="/login" element={<Login />} />
          <Route path={AUTH_CALLBACK_PATH} element={<AuthCallback />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      <Footer />
    </div>
  )
}
