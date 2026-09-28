import { getCategoryName } from '../data/mockCars'

// Small pill showing a car's category. Takes the raw category_id so callers
// can pass a car row straight from the database.
export default function CategoryBadge({ categoryId }) {
  return <span className="badge badge-category">{getCategoryName(categoryId)}</span>
}
