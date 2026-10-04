// Booking calls. All of these need a logged-in user, so setAccessToken()
// must have been called first or the API returns 401.
import { request } from './client'

export function getMyBookings({ signal } = {}) {
  return request('/api/bookings', { signal })
}

/**
 * Create a booking.
 * Note we don't send a price — the server computes it from the car's rate,
 * so a tampered client can't book a $250 car for $1.
 */
export function createBooking({ carId, pickup, dropoff }) {
  return request('/api/bookings', {
    method: 'POST',
    body: { car_id: carId, pickup_at: pickup, return_at: dropoff },
  })
}

export function cancelBooking(bookingId) {
  return request(`/api/bookings/${bookingId}/cancel`, { method: 'POST' })
}
