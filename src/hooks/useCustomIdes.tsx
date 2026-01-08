import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react'
import * as api from '../api/tauri'
import type { CustomIde, CustomRemoteIde } from '../types'

const CUSTOM_IDES_KEY = 'customIdes'
const CUSTOM_REMOTE_IDES_KEY = 'customRemoteIdes'

interface CustomIdesContextType {
  // Local custom IDEs
  customIdes: CustomIde[]
  addCustomIde: (ide: CustomIde) => Promise<void>
  updateCustomIde: (id: string, ide: Partial<Omit<CustomIde, 'id'>>) => Promise<void>
  deleteCustomIde: (id: string) => Promise<void>
  // Remote custom IDEs
  customRemoteIdes: CustomRemoteIde[]
  addCustomRemoteIde: (ide: CustomRemoteIde) => Promise<void>
  updateCustomRemoteIde: (id: string, ide: Partial<Omit<CustomRemoteIde, 'id'>>) => Promise<void>
  deleteCustomRemoteIde: (id: string) => Promise<void>
  loading: boolean
}

const CustomIdesContext = createContext<CustomIdesContextType | null>(null)

export function CustomIdesProvider({ children }: { children: ReactNode }) {
  const [customIdes, setCustomIdes] = useState<CustomIde[]>([])
  const [customRemoteIdes, setCustomRemoteIdes] = useState<CustomRemoteIde[]>([])
  const [loading, setLoading] = useState(true)

  // Load custom IDEs from settings on mount
  useEffect(() => {
    Promise.all([api.getSetting(CUSTOM_IDES_KEY), api.getSetting(CUSTOM_REMOTE_IDES_KEY)])
      .then(([localData, remoteData]) => {
        if (localData) {
          try {
            const parsed = JSON.parse(localData) as CustomIde[]
            setCustomIdes(parsed)
          } catch {
            console.error('Failed to parse custom IDEs from settings')
          }
        }
        if (remoteData) {
          try {
            const parsed = JSON.parse(remoteData) as CustomRemoteIde[]
            setCustomRemoteIdes(parsed)
          } catch {
            console.error('Failed to parse custom remote IDEs from settings')
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

  // Save custom remote IDEs to settings
  const saveCustomRemoteIdes = useCallback(async (ides: CustomRemoteIde[]) => {
    await api.setSetting(CUSTOM_REMOTE_IDES_KEY, JSON.stringify(ides))
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

  // Remote custom IDE CRUD operations
  const addCustomRemoteIde = useCallback(
    async (ide: CustomRemoteIde) => {
      // Check for duplicate id
      if (customRemoteIdes.some((existing) => existing.id === ide.id)) {
        throw new Error(`Remote IDE with id "${ide.id}" already exists`)
      }
      const newIdes = [...customRemoteIdes, ide]
      setCustomRemoteIdes(newIdes)
      await saveCustomRemoteIdes(newIdes)
    },
    [customRemoteIdes, saveCustomRemoteIdes]
  )

  const updateCustomRemoteIde = useCallback(
    async (id: string, updates: Partial<Omit<CustomRemoteIde, 'id'>>) => {
      const newIdes = customRemoteIdes.map((ide) => (ide.id === id ? { ...ide, ...updates } : ide))
      setCustomRemoteIdes(newIdes)
      await saveCustomRemoteIdes(newIdes)
    },
    [customRemoteIdes, saveCustomRemoteIdes]
  )

  const deleteCustomRemoteIde = useCallback(
    async (id: string) => {
      const newIdes = customRemoteIdes.filter((ide) => ide.id !== id)
      setCustomRemoteIdes(newIdes)
      await saveCustomRemoteIdes(newIdes)
    },
    [customRemoteIdes, saveCustomRemoteIdes]
  )

  return (
    <CustomIdesContext.Provider
      value={{
        customIdes,
        addCustomIde,
        updateCustomIde,
        deleteCustomIde,
        customRemoteIdes,
        addCustomRemoteIde,
        updateCustomRemoteIde,
        deleteCustomRemoteIde,
        loading,
      }}
    >
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
