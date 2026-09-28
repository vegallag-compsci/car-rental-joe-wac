// ---------------------------------------------------------------------------
// MOCK DATA
// Field names here match our real database columns exactly, so swapping this
// file out for Supabase queries later should not require touching components.
//
// When we go live, replace the exported arrays with data fetched from Supabase
// (see helper stubs at the bottom of this file).
// ---------------------------------------------------------------------------

export const carCategories = [
  { id: 1, name: 'Economy' },
  { id: 2, name: 'Sedan' },
  { id: 3, name: 'SUV' },
  { id: 4, name: 'Luxury' },
  { id: 5, name: 'Van' },
  { id: 6, name: 'DaBaby' },
]

export const cars = [
  {
    id: 1,
    category_id: 1,
    make: 'Toyota',
    model: 'Corolla',
    year: 2023,
    color: 'Silver',
    seats: 5,
    transmission: 'automatic',
    mileage: 18420,
    daily_rate: 42,
    image_url: 'https://placehold.co/600x400?text=Toyota+Corolla',
    is_active: true,
  },
  {
    id: 2,
    category_id: 6,
    make: 'DaBaby',
    model: 'Mobile',
    year: 2019,
    color: 'Brown',
    seats: 1,
    transmission: 'AutoManual',
    mileage: 31780,
    daily_rate: 500,
    image_url: 'https://lede-admin.dailydot.com/wp-content/uploads/sites/69/2024/07/dababy-convertible.jpg',
    is_active: true,
  },
  {
    id: 3,
    category_id: 1,
    make: 'Kia',
    model: 'Rio',
    year: 2021,
    color: 'Blue',
    seats: 5,
    transmission: 'manual',
    mileage: 47310,
    daily_rate: 38,
    image_url: 'https://placehold.co/600x400?text=Kia+Rio',
    is_active: false,
  },
  {
    id: 4,
    category_id: 2,
    make: 'Toyota',
    model: 'Camry',
    year: 2024,
    color: 'Black',
    seats: 5,
    transmission: 'automatic',
    mileage: 9120,
    daily_rate: 58,
    image_url: 'https://placehold.co/600x400?text=Toyota+Camry',
    is_active: true,
  },
  {
    id: 5,
    category_id: 2,
    make: 'Honda',
    model: 'Accord',
    year: 2023,
    color: 'Gray',
    seats: 5,
    transmission: 'automatic',
    mileage: 22650,
    daily_rate: 62,
    image_url: 'https://placehold.co/600x400?text=Honda+Accord',
    is_active: true,
  },
  {
    id: 6,
    category_id: 3,
    make: 'Jeep',
    model: 'Grand Cherokee',
    year: 2023,
    color: 'Green',
    seats: 5,
    transmission: 'automatic',
    mileage: 27400,
    daily_rate: 89,
    image_url: 'https://placehold.co/600x400?text=Jeep+Grand+Cherokee',
    is_active: true,
  },
  {
    id: 7,
    category_id: 3,
    make: 'Subaru',
    model: 'Outback',
    year: 2022,
    color: 'White',
    seats: 5,
    transmission: 'automatic',
    mileage: 38990,
    daily_rate: 76,
    image_url: 'https://placehold.co/600x400?text=Subaru+Outback',
    is_active: true,
  },
  {
    id: 8,
    category_id: 3,
    make: 'Ford',
    model: 'Explorer',
    year: 2024,
    color: 'Black',
    seats: 7,
    transmission: 'automatic',
    mileage: 12030,
    daily_rate: 95,
    image_url: 'https://placehold.co/600x400?text=Ford+Explorer',
    is_active: true,
  },
  {
    id: 9,
    category_id: 4,
    make: 'BMW',
    model: '5 Series',
    year: 2024,
    color: 'Black',
    seats: 5,
    transmission: 'automatic',
    mileage: 6480,
    daily_rate: 165,
    image_url: 'https://placehold.co/600x400?text=BMW+5+Series',
    is_active: true,
  },
  {
    id: 10,
    category_id: 4,
    make: 'Porsche',
    model: 'Macan',
    year: 2023,
    color: 'White',
    seats: 5,
    transmission: 'automatic',
    mileage: 11250,
    daily_rate: 250,
    image_url: 'https://placehold.co/600x400?text=Porsche+Macan',
    is_active: true,
  },
  {
    id: 11,
    category_id: 5,
    make: 'Chrysler',
    model: 'Pacifica',
    year: 2023,
    color: 'Silver',
    seats: 7,
    transmission: 'automatic',
    mileage: 34870,
    daily_rate: 105,
    image_url: 'https://placehold.co/600x400?text=Chrysler+Pacifica',
    is_active: true,
  },
  {
    id: 12,
    category_id: 5,
    make: 'Mercedes-Benz',
    model: 'Sprinter',
    year: 2022,
    color: 'White',
    seats: 12,
    transmission: 'manual',
    mileage: 56200,
    daily_rate: 140,
    image_url: 'https://placehold.co/600x400?text=Mercedes+Sprinter',
    is_active: true,
  },
]

export const bookings = [
  {
    id: 1,
    car_id: 4,
    pickup_at: '2026-10-04',
    return_at: '2026-10-08',
    status: 'confirmed',
    total_price: 232,
  },
  {
    id: 2,
    car_id: 9,
    pickup_at: '2026-10-18',
    return_at: '2026-10-21',
    status: 'pending',
    total_price: 495,
  },
  {
    id: 3,
    car_id: 1,
    pickup_at: '2026-09-12',
    return_at: '2026-09-16',
    status: 'returned',
    total_price: 168,
  },
]

// --- Small helpers so pages don't have to know how the data is shaped --------

export function getCategoryName(categoryId) {
  const category = carCategories.find((c) => c.id === categoryId)
  return category ? category.name : 'Unknown'
}

export function getCarById(id) {
  return cars.find((car) => car.id === Number(id))
}

export function getCarLabel(car) {
  return car ? `${car.year} ${car.make} ${car.model}` : 'Unknown car'
}

// Number of whole days between two YYYY-MM-DD strings. Always at least 1 so
// the price box never shows 0 or a negative total.
export function daysBetween(pickup, dropoff) {
  if (!pickup || !dropoff) return 0
  const start = new Date(pickup)
  const end = new Date(dropoff)
  const diff = Math.round((end - start) / (1000 * 60 * 60 * 24))
  return diff > 0 ? diff : 0
}

export function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatMoney(amount) {
  return `$${Number(amount).toLocaleString('en-US')}`
}
