import { getCategories } from '../api/cars'
import { useAsync } from './useAsync'

// Categories almost never change, and every CategoryBadge on a page needs
// them, so the request is made once and the promise is shared by every caller.
// A failed request is forgotten so the next caller retries.
let categoriesPromise = null

function loadCategories() {
  categoriesPromise ??= getCategories().catch((error) => {
    categoriesPromise = null
    throw error
  })
  return categoriesPromise
}

/** { categories, loading, error, getCategoryName } */
export function useCategories() {
  const { data, loading, error } = useAsync(() => loadCategories(), [])
  const categories = data ?? []

  function getCategoryName(categoryId) {
    return categories.find((c) => c.id === categoryId)?.name ?? ''
  }

  return { categories, loading, error, getCategoryName }
}
