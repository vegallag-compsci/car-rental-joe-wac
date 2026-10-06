// Admin calls. All need an admin login; anyone else gets a 403 from Flask,
// and RLS refuses them in the database regardless.
import { query, request } from './client'

/** Every car, including inactive ones. */
export function getAdminCars({ signal } = {}) {
  return request('/api/admin/cars', { signal })
}

export function createCar(fields) {
  return request('/api/admin/cars', { method: 'POST', body: fields })
}

/** Partial update, e.g. updateCar(3, { is_active: true }). */
export function updateCar(carId, fields) {
  return request(`/api/admin/cars/${carId}`, { method: 'PATCH', body: fields })
}

/** Everyone's bookings, each with `car` and `customer_email`. */
export function getAdminBookings({ status, signal } = {}) {
  return request(`/api/admin/bookings${query({ status })}`, { signal })
}

export function setBookingStatus(bookingId, status) {
  return request(`/api/admin/bookings/${bookingId}`, {
    method: 'PATCH',
    body: { status },
  })
}

/** Users whose email contains `email` (any case); all users if empty. */
export function searchUsers({ email, signal } = {}) {
  return request(`/api/admin/users${query({ email })}`, { signal })
}

/**
 * One page of the audit log, newest first: { entries, has_more }.
 * `type` narrows to car | category | booking | user; pass the last entry's id
 * as `before` to get the next page.
 */
export function getAuditLog({ type, before, signal } = {}) {
  return request(`/api/admin/audit${query({ type, before })}`, { signal })
}

export function setUserRole(userId, role) {
  return request(`/api/admin/users/${userId}`, {
    method: 'PATCH',
    body: { role },
  })
}
