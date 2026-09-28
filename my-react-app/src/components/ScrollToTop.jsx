import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Without this the browser keeps your scroll position when the route changes,
// so clicking a car halfway down the grid lands you halfway down the details.
export default function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}
