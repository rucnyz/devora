import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react'
import * as api from '../api/tauri'
import type { CustomIde } from '../types'

const CUSTOM_IDES_KEY = 'customIdes'

interface CustomIdesContextType {
  customIdes: CustomIde[]
  addCustomIde: (ide: CustomIde) => Promise<void>
  updateCustomIde: (id: string, ide: Partial<Omit<CustomIde, 'id'>>) => Promise<void>
  deleteCustomIde: (id: string) => Promise<void>
  loading: boolean
}

const CustomIdesContext = createContext<CustomIdesContextType | null>(null)

export function CustomIdesProvider({ children }: { children: ReactNode }) {
  const [customIdes, setCustomIdes] = useState<CustomIde[]>([])
  const [loading, setLoading] = useState(true)

  // Load custom IDEs from settings on mount
  useEffect(() => {
    api
      .getSetting(CUSTOM_IDES_KEY)
      .then((data) => {
        if (data) {
          try {
            const parsed = JSON.parse(data) as CustomIde[]
            setCustomIdes(parsed)
          } catch {
            console.error('Failed to parse custom IDEs from settings')
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // Save custom IDEs to settings
  const saveCustomIdes = useCallback(async (ides: CustomIde[]) => {
    await api.setSetting(CUSTOM_IDES_KEY, JSON.stringify(ides))
  }, [])

  const addCustomIde = useCallback(
    async (ide: CustomIde) => {
      // Check for duplicate id
      if (customIdes.some((existing) => existing.id === ide.id)) {
        throw new Error(`IDE with id "${ide.id}" already exists`)
      }
      const newIdes = [...customIdes, ide]
      setCustomIdes(newIdes)
      await saveCustomIdes(newIdes)
    },
    [customIdes, saveCustomIdes]
  )

  const updateCustomIde = useCallback(
    async (id: string, updates: Partial<Omit<CustomIde, 'id'>>) => {
      const newIdes = customIdes.map((ide) => (ide.id === id ? { ...ide, ...updates } : ide))
      setCustomIdes(newIdes)
      await saveCustomIdes(newIdes)
    },
    [customIdes, saveCustomIdes]
  )

  const deleteCustomIde = useCallback(
    async (id: string) => {
      const newIdes = customIdes.filter((ide) => ide.id !== id)
      setCustomIdes(newIdes)
      await saveCustomIdes(newIdes)
    },
    [customIdes, saveCustomIdes]
  )

  return (
    <CustomIdesContext.Provider value={{ customIdes, addCustomIde, updateCustomIde, deleteCustomIde, loading }}>
      {children}
    </CustomIdesContext.Provider>
  )
}

// Hook to access custom IDEs
export function useCustomIdes() {
  const context = useContext(CustomIdesContext)
  if (!context) {
    throw new Error('useCustomIdes must be used within a CustomIdesProvider')
  }
  return context
}
