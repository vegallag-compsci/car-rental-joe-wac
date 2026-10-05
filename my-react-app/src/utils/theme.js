// Light/dark preference. With no saved choice the site follows the OS
// (prefers-color-scheme). A saved choice sets data-theme on <html>, which
// index.css turns into color-scheme for its light-dark() tokens.
// index.html applies the saved value before first paint; keep the key in sync.
const STORAGE_KEY = 'theme'

export function getTheme() {
  const chosen = document.documentElement.dataset.theme
  if (chosen) return chosen
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function saveTheme(theme) {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Storage blocked (e.g. private mode): the choice lasts until reload.
  }
}
