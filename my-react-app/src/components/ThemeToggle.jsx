import { useState } from 'react'
import { getTheme, saveTheme } from '../utils/theme'
import { MoonIcon, SunIcon } from './icons'

// Switches between light and dark. Until it's first used, the site follows
// the OS setting.
export default function ThemeToggle() {
  const [theme, setTheme] = useState(getTheme)
  const next = theme === 'dark' ? 'light' : 'dark'
  const label = `Switch to ${next} mode`

  function handleClick() {
    saveTheme(next)
    setTheme(next)
  }

  return (
    <button type="button" className="icon-btn" aria-label={label} title={label} onClick={handleClick}>
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}
