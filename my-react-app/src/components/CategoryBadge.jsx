import { useCategories } from '../hooks/useCategories'

// Small pill showing a car's category. Takes the raw category_id so callers
// can pass a car row straight from the API.
export default function CategoryBadge({ categoryId }) {
  const { getCategoryName } = useCategories()
  const name = getCategoryName(categoryId)

  // Render nothing until categories arrive rather than flashing "Unknown".
  if (!name) return null
  return <span className="badge badge-category">{name}</span>
}
