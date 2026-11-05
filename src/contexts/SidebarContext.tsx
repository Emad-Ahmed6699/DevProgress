'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'

interface SidebarContextType {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  toggle: () => void
  close: () => void
}

const SidebarContext = createContext<SidebarContextType>({
  isOpen: false,
  setIsOpen: () => {},
  toggle: () => {},
  close: () => {},
})

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  const toggle = () => setIsOpen((prev) => !prev)
  const close = () => setIsOpen(false)

  // Auto-close mobile sidebar whenever route changes
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  return (
    <SidebarContext.Provider value={{ isOpen, setIsOpen, toggle, close }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  return useContext(SidebarContext)
}

