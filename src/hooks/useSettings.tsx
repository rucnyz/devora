import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react'
import * as api from '../api/tauri'

// Default settings values
export const DEFAULT_SETTINGS = {
  fileCardMaxSize: 1024 * 1024, // 1MB in bytes
  zoomLevel: 100, // percentage, range 50-200, step 10
  defaultTerminal: '', // empty means platform default (cmd on Windows, Terminal on macOS, gnome-terminal on Linux)
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
    api
      .getAllSettings()
      .then((data: Record<string, string>) => {
        const parsed = { ...DEFAULT_SETTINGS }
        for (const key of Object.keys(DEFAULT_SETTINGS) as SettingKey[]) {
          if (data[key] !== undefined) {
            const defaultValue = DEFAULT_SETTINGS[key]
            if (typeof defaultValue === 'number') {
              const numValue = Number(data[key])
              // Only use parsed value if it's a valid number, otherwise keep default
              if (!isNaN(numValue)) {
                ;(parsed as Record<string, unknown>)[key] = numValue
              }
            } else {
              {
                ;(parsed as Record<string, unknown>)[key] = data[key]
              }
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
    await api.setSetting(key, String(value))
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
