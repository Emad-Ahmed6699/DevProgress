'use client'

import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useProfile } from '@/contexts/ProfileContext'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface TopbarProps {
  searchPlaceholder?: string
  onSearch?: (value: string) => void
}

export default function Topbar({ searchPlaceholder = 'Search...', onSearch }: TopbarProps) {
  const { activeProfile } = useProfile()

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <header className="fixed top-0 right-0 w-[calc(100%-280px)] h-16 flex justify-between items-center px-6 z-40 bg-[#0b1326]/60 backdrop-blur-lg border-b border-white/10">
      {/* Search */}
      <div className="relative w-96">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c2c6d6]/50" />
        <Input
          placeholder={searchPlaceholder}
          onChange={(e) => onSearch?.(e.target.value)}
          className="pl-9 bg-[#2d3449]/30 border-white/5 text-[#dae2fd] placeholder:text-[#c2c6d6]/40 focus:ring-2 focus:ring-[#adc6ff]/40 focus:border-transparent rounded-full text-sm h-9"
        />
      </div>

      {/* Right section */}
      <div className="flex items-center gap-4">

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
