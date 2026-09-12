import * as React from 'react'

export type ThemeSelection = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export interface ThemeContextValue {
  theme: ThemeSelection
  resolvedTheme: ResolvedTheme
  setTheme: (theme: ThemeSelection) => void
  toggleTheme: () => void
}

const STORAGE_KEY = 'invoiceui:theme'

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function resolveTheme(selection: ThemeSelection): ResolvedTheme {
  if (selection === 'system') {
    return getSystemTheme()
  }
  return selection
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null)

export interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: ThemeSelection
  storageKey?: string
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = STORAGE_KEY,
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<ThemeSelection>(() => {
    if (typeof window === 'undefined') return defaultTheme
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored
      }
    } catch {
      // Ignore storage access errors
    }
    return defaultTheme
  })

  const [systemTheme, setSystemTheme] = React.useState<ResolvedTheme>(getSystemTheme)

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      setSystemTheme(mediaQuery.matches ? 'dark' : 'light')
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  const resolvedTheme: ResolvedTheme = theme === 'system' ? systemTheme : theme

  const applyThemeToDOM = React.useCallback((targetResolved: ResolvedTheme) => {
    if (typeof document === 'undefined') return
    document.documentElement.dataset.theme = targetResolved
    document.documentElement.classList.toggle('dark', targetResolved === 'dark')
  }, [])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(storageKey, theme)
    } catch {
      // Ignore storage access errors
    }
    applyThemeToDOM(resolvedTheme)
  }, [theme, resolvedTheme, storageKey, applyThemeToDOM])

  const setTheme = React.useCallback((nextTheme: ThemeSelection) => {
    setThemeState(nextTheme)
  }, [])

  const toggleTheme = React.useCallback(() => {
    setThemeState((prev) => {
      if (prev === 'light') return 'dark'
      if (prev === 'dark') return 'system'
      return 'light'
    })
  }, [])

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      toggleTheme,
    }),
    [theme, resolvedTheme, setTheme, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = React.useContext(ThemeContext)
  if (context) {
    return context
  }

  // Fallback if rendered outside ThemeProvider
  const isDark =
    typeof document !== 'undefined' &&
    (document.documentElement.dataset.theme === 'dark' ||
      document.documentElement.classList.contains('dark'))
  const resolved: ResolvedTheme = isDark ? 'dark' : 'light'

  return {
    theme: resolved,
    resolvedTheme: resolved,
    setTheme: (t: ThemeSelection) => {
      if (typeof window === 'undefined') return
      try {
        localStorage.setItem(STORAGE_KEY, t)
      } catch {
        // Ignore
      }
      const nextResolved = resolveTheme(t)
      document.documentElement.dataset.theme = nextResolved
      document.documentElement.classList.toggle('dark', nextResolved === 'dark')
    },
    toggleTheme: () => {
      const next = resolved === 'dark' ? 'light' : 'dark'
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY, next)
        } catch {
          // Ignore
        }
        document.documentElement.dataset.theme = next
        document.documentElement.classList.toggle('dark', next === 'dark')
      }
    },
  }
}
