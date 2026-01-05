import { useCallback, useEffect, useState } from 'react'

export interface Settings {
  theme: 'light' | 'dark' | 'system'
  logLevel: 'debug' | 'info' | 'warn' | 'error'
}

const STORAGE_KEY = 'pai-settings'

const defaultSettings: Settings = {
  theme: 'system',
  logLevel: 'info',
}

function getStoredSettings(): Settings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return { ...defaultSettings, ...JSON.parse(stored) }
    }
  } catch {
    // ignore
  }
  return defaultSettings
}

function applyTheme(theme: Settings['theme']): void {
  const root = document.documentElement
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  if (isDark) {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

export function useSettings() {
  const [settings, setSettingsState] = useState<Settings>(getStoredSettings)

  // Apply theme on mount and when settings change
  useEffect(() => {
    applyTheme(settings.theme)
  }, [settings.theme])

  // Listen for system theme changes
  useEffect(() => {
    if (settings.theme !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('system')

    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [settings.theme])

  const setSettings = useCallback((updates: Partial<Settings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...updates }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const resetSettings = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setSettingsState(defaultSettings)
  }, [])

  return { settings, setSettings, resetSettings }
}
