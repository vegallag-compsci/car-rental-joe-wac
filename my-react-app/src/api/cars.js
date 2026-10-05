// Car and category calls. Public endpoints, no login needed.
import { query, request } from './client'

/**
 * Cars, filtered and sorted server-side.
 * Pass both pickup and return to get only cars free for those dates.
 */
export function getCars({ categoryId, sort, pickup, dropoff, signal } = {}) {
  const qs = query({
    category: categoryId,
    sort,
    pickup,
    return: dropoff,
  })
  return request(`/api/cars${qs}`, { signal })
}

export function getCar(id, { signal } = {}) {
  return request(`/api/cars/${id}`, { signal })
}

export function getCategories({ signal } = {}) {
  return request('/api/categories', { signal })
}
