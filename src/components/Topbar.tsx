'use client'

import { Search, Menu } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useProfile } from '@/contexts/ProfileContext'
import { useSidebar } from '@/contexts/SidebarContext'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface TopbarProps {
  searchPlaceholder?: string
  onSearch?: (value: string) => void
}

export default function Topbar({ searchPlaceholder = 'Search...', onSearch }: TopbarProps) {
  const { activeProfile } = useProfile()
  const { toggle } = useSidebar()

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <header className="fixed top-0 right-0 w-full md:w-[calc(100%-280px)] h-16 flex justify-between items-center px-4 sm:px-6 z-40 bg-[#0b1326]/80 backdrop-blur-lg border-b border-white/10">
      {/* Left section: Hamburger (mobile) + Search */}
      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 pr-2">
        <button
          onClick={toggle}
          className="md:hidden p-2 rounded-xl text-[#dae2fd] hover:text-white hover:bg-white/5 border border-white/10 flex-shrink-0 transition-colors"
          title="Open Navigation Menu"
          aria-label="Open Navigation Menu"
        >
          <Menu size={18} />
        </button>

        {/* Search */}
        <div className="relative w-full max-w-[200px] sm:max-w-xs md:max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c2c6d6]/50" />
          <Input
            placeholder={searchPlaceholder}
            onChange={(e) => onSearch?.(e.target.value)}
            className="pl-9 bg-[#2d3449]/30 border-white/5 text-[#dae2fd] placeholder:text-[#c2c6d6]/40 focus:ring-2 focus:ring-[#adc6ff]/40 focus:border-transparent rounded-full text-xs sm:text-sm h-9"
          />
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-[#dae2fd]">{activeProfile?.name || '...'}</p>
            <p className="text-[10px] text-[#c2c6d6]/60 uppercase tracking-widest">{activeProfile?.role}</p>
          </div>
          <Avatar className="w-9 h-9 border-2 border-[#adc6ff]/20">
            <AvatarImage src={activeProfile?.avatar_url || ''} alt={activeProfile?.name} />
            <AvatarFallback className="bg-[#4d8eff]/20 text-[#adc6ff] text-xs font-bold">
              {activeProfile ? getInitials(activeProfile.name) : '?'}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  )
}
