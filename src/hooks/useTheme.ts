import { useEffect, useState } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'

export function useTheme() {
  const [theme, setTheme] = useState<ThemePreference>(() => {
    return (localStorage.getItem('cinejuntos-theme') as ThemePreference) || 'system'
  })

  useEffect(() => {
    localStorage.setItem('cinejuntos-theme', theme)
    const media = window.matchMedia('(prefers-color-scheme: dark)')

    const applyTheme = () => {
      if (theme === 'system') {
        document.documentElement.removeAttribute('data-theme')
      } else {
        document.documentElement.setAttribute('data-theme', theme)
      }
    }

    applyTheme()
    media.addEventListener('change', applyTheme)
    return () => media.removeEventListener('change', applyTheme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((current) => {
      if (current === 'system') return 'light'
      if (current === 'light') return 'dark'
      return 'system'
    })
  }

  return { theme, setTheme, toggleTheme }
}
