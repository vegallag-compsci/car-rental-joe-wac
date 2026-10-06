// Display helpers shared across pages. Dates are YYYY-MM-DD strings end to
// end, matching the API and the `date` columns in the database.

const MS_PER_DAY = 1000 * 60 * 60 * 24

export function getCarLabel(car) {
  return car ? `${car.year} ${car.make} ${car.model}` : 'Unknown car'
}

// Nights between two YYYY-MM-DD strings (return - pickup), or 0 if the range
// is missing or backwards. Keep in sync with days_between in api/app/validation.py.
export function daysBetween(pickup, dropoff) {
  if (!pickup || !dropoff) return 0
  const diff = Math.round((new Date(dropoff) - new Date(pickup)) / MS_PER_DAY)
  return diff > 0 ? diff : 0
}

// "Today + offset days" as YYYY-MM-DD in the user's local time zone, which
// is the format <input type="date"> expects.
export function dateInDays(offset) {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function formatDate(value) {
  if (!value) return '—'
  // new Date('2026-10-04') parses as UTC midnight, which is the previous
  // evening in US time zones. Build the date from its parts so it stays local.
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// A full timestamp (e.g. created_at), shown in the viewer's own time zone.
export function formatDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatMoney(amount) {
  return `$${Math.round(Number(amount)).toLocaleString('en-US')}`
}

export function formatMileage(miles) {
  return `${Number(miles).toLocaleString('en-US')} mi`
}

export function formatSeats(seats) {
  return `${seats} ${seats === 1 ? 'seat' : 'seats'}`
}

// transmission is stored lowercase ('automatic' | 'manual'). Capitalized here
// rather than with CSS text-transform, which would also turn "mi" into "Mi".
export function formatTransmission(transmission) {
  return transmission.charAt(0).toUpperCase() + transmission.slice(1)
}
