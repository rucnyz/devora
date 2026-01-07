import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react'

const API_BASE = '/api/settings'

// Default settings values
export const DEFAULT_SETTINGS = {
  fileCardMaxSize: 1024 * 1024, // 1MB in bytes
}

export type SettingKey = keyof typeof DEFAULT_SETTINGS
type SettingsState = typeof DEFAULT_SETTINGS

interface SettingsContextType {
  settings: SettingsState
  updateSetting: <K extends SettingKey>(key: K, value: SettingsState[K]) => Promise<void>
  loading: boolean
}

const SettingsContext = createContext<SettingsContextType | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)

  // Load all settings on mount
  useEffect(() => {
    fetch(API_BASE)
      .then((res) => res.json())
      .then((data: Record<string, string>) => {
        const parsed = { ...DEFAULT_SETTINGS }
        for (const key of Object.keys(DEFAULT_SETTINGS) as SettingKey[]) {
          if (data[key] !== undefined) {
            const defaultValue = DEFAULT_SETTINGS[key]
            if (typeof defaultValue === 'number') {
              parsed[key] = Number(data[key]) as typeof defaultValue
            }
          }
        }
        setSettings(parsed)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const updateSetting = useCallback(async <K extends SettingKey>(key: K, value: SettingsState[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    await fetch(`${API_BASE}/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: String(value) }),
    })
  }, [])

  return <SettingsContext.Provider value={{ settings, updateSetting, loading }}>{children}</SettingsContext.Provider>
}

// Hook to get and set a single setting
export function useSetting<K extends SettingKey>(key: K) {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSetting must be used within a SettingsProvider')
  }

  const { settings, updateSetting, loading } = context
  const value = settings[key]

  const updateValue = useCallback(
    (newValue: SettingsState[K]) => {
      return updateSetting(key, newValue)
    },
    [key, updateSetting]
  )

  return { value, updateValue, loading }
}
