'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase, Profile } from '@/lib/supabase'

interface ProfileContextType {
  activeProfile: Profile | null
  profiles: Profile[]
  setActiveProfile: (profile: Profile) => void
  refreshProfiles: () => Promise<void>
  loading: boolean
}

const ProfileContext = createContext<ProfileContextType>({
  activeProfile: null,
  profiles: [],
  setActiveProfile: () => {},
  refreshProfiles: async () => {},
  loading: true,
})

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfiles = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').order('name')
    if (data && data.length > 0) {
      setProfiles(data)
      // Only set active profile on first load (when there's no active profile set)
      setActiveProfile((prev) => {
        if (prev) {
          // Refresh the active profile data in case it was updated
          return data.find((p: Profile) => p.id === prev.id) || prev
        }
        // Default to Emad Ahmed on first load
        return data.find((p: Profile) => p.name === 'Emad Ahmed') || data[0]
      })
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchProfiles()
  }, [fetchProfiles])

  return (
    <ProfileContext.Provider value={{ activeProfile, profiles, setActiveProfile, refreshProfiles: fetchProfiles, loading }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  return useContext(ProfileContext)
}
