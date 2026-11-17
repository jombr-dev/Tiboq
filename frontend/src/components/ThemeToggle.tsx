import { useState } from 'react'
import { Moon, Sun } from 'lucide-react'

type Theme = 'light' | 'dark'
const preferenceKey = 'tiboq-theme'

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(preferenceKey)
    if (saved === 'light' || saved === 'dark') return saved
  } catch { /* Storage can be unavailable in private browser contexts. */ }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function initializeTheme() {
  document.documentElement.dataset.theme = initialTheme()
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(initialTheme)
  function toggle() {
    const next = theme === 'light' ? 'dark' : 'light'
    document.documentElement.dataset.theme = next
    setTheme(next)
    try { localStorage.setItem(preferenceKey, next) } catch { /* Keep the in-memory choice. */ }
  }
  return <button type="button" className="btn theme-toggle" onClick={toggle}
    aria-label="Dark mode" aria-pressed={theme === 'dark'}
    title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
    {theme === 'light' ? <Moon size={16} aria-hidden="true"/> : <Sun size={16} aria-hidden="true"/>}
    <span className="hidden sm:inline">{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
  </button>
}
