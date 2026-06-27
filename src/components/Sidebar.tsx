'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, BookOpen, Users, Settings, ChevronDown, Check, Lock, Palette, UserPlus, Trash2 } from 'lucide-react'
import { useProfile } from '@/contexts/ProfileContext'
import { supabase, Profile } from '@/lib/supabase'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/courses', label: 'Courses', icon: BookOpen },
  { href: '/team', label: 'Team Members', icon: Users },
]

const themes = {
  blue: {
    name: 'Neon Blue',
    class: 'bg-blue-600',
    color: '#adc6ff',
    glow: 'rgba(59, 130, 246, 0.3)',
    glowStrong: 'rgba(59, 130, 246, 0.5)',
    shadow: 'rgba(59, 130, 246, 0.2)',
    btnStart: '#4d8eff',
    btnEnd: '#3131c0'
  },
  green: {
    name: 'Emerald Green',
    class: 'bg-emerald-500',
    color: '#4edea3',
    glow: 'rgba(78, 222, 163, 0.3)',
    glowStrong: 'rgba(78, 222, 163, 0.5)',
    shadow: 'rgba(78, 222, 163, 0.2)',
    btnStart: '#4edea3',
    btnEnd: '#00a572'
  },
  violet: {
    name: 'Royal Violet',
    class: 'bg-violet-500',
    color: '#c0c1ff',
    glow: 'rgba(192, 193, 255, 0.3)',
    glowStrong: 'rgba(192, 193, 255, 0.5)',
    shadow: 'rgba(192, 193, 255, 0.2)',
    btnStart: '#c0c1ff',
    btnEnd: '#6366f1'
  },
  red: {
    name: 'Crimson Red',
    class: 'bg-red-500',
    color: '#ffb4ab',
    glow: 'rgba(239, 68, 68, 0.3)',
    glowStrong: 'rgba(239, 68, 68, 0.5)',
    shadow: 'rgba(239, 68, 68, 0.2)',
    btnStart: '#ff897a',
    btnEnd: '#ba1a1a'
  }
}

export default function Sidebar() {
  const pathname = usePathname()
  const { activeProfile, profiles, setActiveProfile, refreshProfiles } = useProfile()

  // Settings & Theme states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [settingsMode, setSettingsMode] = useState<'select' | 'theme' | 'login' | 'manage'>('select')
  const [activeTheme, setActiveTheme] = useState<keyof typeof themes>('blue')

  // Login states
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')

  // Add member states
  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberRole, setNewMemberRole] = useState('')
  const [newMemberAvatar, setNewMemberAvatar] = useState('')
  const [isSavingMember, setIsSavingMember] = useState(false)
  const [addMemberError, setAddMemberError] = useState('')
  const [addMemberSuccess, setAddMemberSuccess] = useState(false)

  // Delete member states
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null)

  // Sidebar profiles/activities feed
  const [sidebarMembers, setSidebarMembers] = useState<(Profile & { latestActivity: string })[]>([])

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)

  const changeTheme = useCallback((key: keyof typeof themes) => {
    const t = themes[key]
    document.documentElement.style.setProperty('--accent-color', t.color)
    document.documentElement.style.setProperty('--accent-glow', t.glow)
    document.documentElement.style.setProperty('--accent-glow-strong', t.glowStrong)
    document.documentElement.style.setProperty('--accent-shadow-color', t.shadow)
    document.documentElement.style.setProperty('--btn-start', t.btnStart)
    document.documentElement.style.setProperty('--btn-end', t.btnEnd)
    setActiveTheme(key)
    localStorage.setItem('dev-progress-theme', key)
  }, [])

  const fetchSidebarMembers = useCallback(async () => {
    const { data: pData } = await supabase.from('profiles').select('*')
    if (pData) {
      const membersWithActivity = await Promise.all(
        pData.map(async (profile) => {
          const { data: actData } = await supabase
            .from('activities')
            .select('description, created_at')
            .eq('user_id', profile.id)
            .order('created_at', { ascending: false })
            .limit(1)
          return {
            ...profile,
            latestActivity: actData && actData.length > 0 ? actData[0].description : 'Joined the squad'
          }
        })
      )
      setSidebarMembers(membersWithActivity)
    }
  }, [])

  useEffect(() => {
    const savedTheme = localStorage.getItem('dev-progress-theme') as keyof typeof themes
    if (savedTheme && themes[savedTheme]) {
      changeTheme(savedTheme)
    }
    fetchSidebarMembers()
  }, [changeTheme, fetchSidebarMembers, activeProfile])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (email === 'emadahmed@gmail.com' && password === 'emadahmed') {
      setSettingsMode('manage')
      setLoginError('')
      setEmail('')
      setPassword('')
    } else {
      setLoginError('Incorrect email or password.')
    }
  }

  const handleAddMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMemberName.trim() || !newMemberRole.trim()) return
    setIsSavingMember(true)
    setAddMemberError('')
    setAddMemberSuccess(false)

    const insertData: Record<string, unknown> = {
      name: newMemberName.trim(),
      role: newMemberRole.trim(),
      status: 'Active',
    }
    if (newMemberAvatar.trim()) insertData.avatar_url = newMemberAvatar.trim()

    const { data, error } = await supabase.from('profiles').insert(insertData).select()
    console.log('[AddMember] result:', { data, error })

    if (error) {
      setAddMemberError(error.message)
    } else {
      setAddMemberSuccess(true)
      setNewMemberName('')
      setNewMemberRole('')
      setNewMemberAvatar('')
      await Promise.all([fetchSidebarMembers(), refreshProfiles()])
      setTimeout(() => setAddMemberSuccess(false), 2000)
    }
    setIsSavingMember(false)
  }

  const handleDeleteMember = async (profileId: string) => {
    if (deletingMemberId) return
    setDeletingMemberId(profileId)
    try {
      // Delete related records first
      await supabase.from('activities').delete().eq('user_id', profileId)
      await supabase.from('tasks').update({ assignee_id: null }).eq('assignee_id', profileId)
      const { error } = await supabase.from('profiles').delete().eq('id', profileId)
      if (!error) {
        // If we deleted the active profile, switch to another one
        if (activeProfile?.id === profileId && profiles.length > 1) {
          const next = profiles.find(p => p.id !== profileId)
          if (next) setActiveProfile(next)
        }
        await Promise.all([fetchSidebarMembers(), refreshProfiles()])
      }
    } finally {
      setDeletingMemberId(null)
    }
  }

  return (
    <>
      <aside className="w-[280px] h-screen fixed left-0 top-0 flex flex-col py-6 z-50 border-r border-white/10 bg-[#0b1326]/60 backdrop-blur-lg">
        {/* Logo */}
        <div className="px-6 mb-8">
          <h1 className="text-2xl font-bold text-theme-accent tracking-tight">DevProgress</h1>
          <p className="text-xs text-[#c2c6d6]/70 mt-0.5 font-mono">Technical Progression</p>
        </div>

        {/* Nav */}
        <nav className="px-3 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-4 px-4 py-2.5 rounded-lg transition-all duration-300 group ${
                  isActive
                    ? 'text-theme-accent font-bold border-l-4 border-theme-accent bg-theme-accent-10'
                    : 'text-[#c2c6d6] hover:text-[#dae2fd] hover:bg-[#2d3449]/50 border-l-4 border-transparent'
                }`}
              >
                <Icon size={18} />
                <span className="text-sm">{label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Squad Activity Feed */}
        <div className="flex-1 px-6 mt-8 overflow-hidden flex flex-col">
          <h3 className="text-xs font-mono text-[#c2c6d6]/50 uppercase tracking-widest mb-3">Squad Active</h3>
          <div className="space-y-4 overflow-y-auto pr-1 flex-1">
            {sidebarMembers.map((member) => (
              <div key={member.id} className="flex items-center gap-3">
                <Avatar className="w-8 h-8 rounded-lg border border-white/5 flex-shrink-0">
                  <AvatarImage src={member.avatar_url || ''} alt={member.name} />
                  <AvatarFallback className="bg-theme-accent-10 text-theme-accent text-xs font-bold rounded-lg">
                    {getInitials(member.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[#dae2fd] truncate">{member.name}</p>
                  <p className="text-[9px] text-[#c2c6d6]/50 truncate font-mono mt-0.5" title={member.latestActivity}>
                    {member.latestActivity}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom section */}
        <div className="px-3 mt-auto space-y-1 pt-4 border-t border-white/5">
          {/* Profile switcher — no DropdownMenuLabel/Separator to avoid Base UI crash */}
          <DropdownMenu>
            <DropdownMenuTrigger className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#171f33] border border-white/10 hover:border-theme-accent/40 transition-all group">
              <Avatar className="w-9 h-9 border border-theme-accent/20">
                <AvatarImage src={activeProfile?.avatar_url || ''} alt={activeProfile?.name} />
                <AvatarFallback className="bg-theme-accent-10 text-theme-accent text-xs font-bold">
                  {activeProfile ? getInitials(activeProfile.name) : '?'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-semibold text-[#dae2fd] truncate">{activeProfile?.name || 'Loading...'}</p>
                <p className="text-xs text-[#c2c6d6]/60 truncate">{activeProfile?.role}</p>
              </div>
              <ChevronDown size={14} className="text-[#c2c6d6]/50 group-hover:text-theme-accent transition-colors" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align="start"
              className="w-64 bg-[#171f33] border border-white/10 text-[#dae2fd] mb-2"
            >
              {/* Plain header — avoids Base UI MenuGroupContext crash */}
              <div className="px-2 py-1.5 text-[#c2c6d6]/60 text-xs uppercase tracking-wider font-mono">
                Switch Profile
              </div>
              <div className="h-px bg-white/5 mx-2 mb-1" />
              {profiles.map((profile) => (
                <DropdownMenuItem
                  key={profile.id}
                  onClick={() => setActiveProfile(profile)}
                  className={`flex items-center gap-3 cursor-pointer hover:bg-theme-accent-10 focus:bg-theme-accent-10 ${
                    activeProfile?.id === profile.id ? 'bg-theme-accent-10 text-theme-accent' : ''
                  }`}
                >
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={profile.avatar_url || ''} alt={profile.name} />
                    <AvatarFallback className="bg-theme-accent-10 text-theme-accent text-xs">
                      {getInitials(profile.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{profile.name}</p>
                    <p className="text-xs text-[#c2c6d6]/60">{profile.role}</p>
                  </div>
                  {activeProfile?.id === profile.id && (
                    <Check size={14} className="ml-auto text-theme-accent" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            onClick={() => {
              setSettingsMode('select')
              setIsSettingsOpen(true)
            }}
            type="button"
            className="w-full flex items-center gap-4 px-4 py-2.5 rounded-lg text-[#c2c6d6] hover:text-[#dae2fd] hover:bg-[#2d3449]/50 transition-all text-sm text-left"
          >
            <Settings size={18} />
            <span>Settings</span>
          </button>
        </div>
      </aside>

      {/* Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="bg-[#171f33] border border-white/10 text-[#dae2fd] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-theme-accent text-xl">Settings & Customization</DialogTitle>
          </DialogHeader>

          {/* ── SELECT ── */}
          {settingsMode === 'select' && (
            <div className="grid grid-cols-2 gap-4 py-4">
              <button
                onClick={() => setSettingsMode('theme')}
                className="flex flex-col items-center gap-3 p-4 rounded-xl border border-white/5 bg-[#222a3d]/30 hover:border-theme-accent/50 hover:bg-[#222a3d]/60 transition-all"
              >
                <div className="w-12 h-12 rounded-lg bg-theme-accent-10 flex items-center justify-center text-theme-accent">
                  <Palette size={24} />
                </div>
                <span className="font-semibold text-sm">Customize Theme</span>
              </button>

              <button
                onClick={() => setSettingsMode('login')}
                className="flex flex-col items-center gap-3 p-4 rounded-xl border border-white/5 bg-[#222a3d]/30 hover:border-theme-accent/50 hover:bg-[#222a3d]/60 transition-all"
              >
                <div className="w-12 h-12 rounded-lg bg-theme-accent-10 flex items-center justify-center text-theme-accent">
                  <UserPlus size={24} />
                </div>
                <span className="font-semibold text-sm">Manage Members</span>
              </button>
            </div>
          )}

          {/* ── THEME ── */}
          {settingsMode === 'theme' && (
            <div className="space-y-4 py-2">
              <h4 className="text-xs font-mono text-[#c2c6d6] uppercase tracking-wider">Select Accent Color</h4>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(themes).map(([key, value]) => (
                  <button
                    key={key}
                    onClick={() => changeTheme(key as keyof typeof themes)}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-sm transition-all ${
                      activeTheme === key
                        ? 'border-theme-accent bg-theme-accent-10'
                        : 'border-white/5 bg-[#222a3d]/50 hover:bg-[#222a3d]'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full ${value.class} block flex-shrink-0`} />
                    <span className="flex-1 text-left font-medium">{value.name}</span>
                    {activeTheme === key && <Check size={14} className="text-theme-accent" />}
                  </button>
                ))}
              </div>
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSettingsMode('select')}
                  className="px-4 py-2 bg-[#222a3d] hover:bg-[#2d3449] rounded-lg text-sm transition-all"
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {/* ── LOGIN ── */}
          {settingsMode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4 py-2">
              <div className="flex items-center gap-3 mb-2">
                <Lock size={16} className="text-theme-accent" />
                <h4 className="text-xs font-mono text-[#c2c6d6] uppercase tracking-wider">Admin Verification</h4>
              </div>
              <div>
                <label className="text-xs font-mono text-[#c2c6d6]/70 uppercase tracking-widest mb-1 block">Email</label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="bg-[#222a3d] border-white/5 text-[#dae2fd] placeholder:text-[#c2c6d6]/20"
                />
              </div>
              <div>
                <label className="text-xs font-mono text-[#c2c6d6]/70 uppercase tracking-widest mb-1 block">Password</label>
                <Input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-[#222a3d] border-white/5 text-[#dae2fd] placeholder:text-[#c2c6d6]/20"
                />
              </div>
              {loginError && <p className="text-xs text-red-400">{loginError}</p>}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSettingsMode('select')}
                  className="flex-1 py-2 rounded-lg bg-[#222a3d] hover:bg-[#2d3449] text-sm text-center transition-all"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg bg-theme-btn text-white font-semibold text-sm transition-all"
                >
                  Verify
                </button>
              </div>
            </form>
          )}

          {/* ── MANAGE MEMBERS ── */}
          {settingsMode === 'manage' && (
            <div className="py-2 space-y-5">

              {/* Add Member */}
              <form onSubmit={handleAddMemberSubmit} className="space-y-3">
                <h4 className="text-xs font-mono text-[#c2c6d6] uppercase tracking-wider flex items-center gap-2">
                  <UserPlus size={13} /> Add New Member
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-mono text-[#c2c6d6]/60 uppercase tracking-widest mb-1 block">Name *</label>
                    <Input
                      required
                      value={newMemberName}
                      onChange={(e) => setNewMemberName(e.target.value)}
                      placeholder="Full name"
                      className="bg-[#222a3d] border-white/5 text-[#dae2fd] text-sm h-8"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-[#c2c6d6]/60 uppercase tracking-widest mb-1 block">Role *</label>
                    <Input
                      required
                      value={newMemberRole}
                      onChange={(e) => setNewMemberRole(e.target.value)}
                      placeholder="e.g. Backend Dev"
                      className="bg-[#222a3d] border-white/5 text-[#dae2fd] text-sm h-8"
                    />
                  </div>
                </div>
                <Input
                  value={newMemberAvatar}
                  onChange={(e) => setNewMemberAvatar(e.target.value)}
                  placeholder="Avatar URL (optional)"
                  className="bg-[#222a3d] border-white/5 text-[#dae2fd] text-sm h-8"
                />
                {addMemberError && (
                  <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5">
                    ❌ {addMemberError}
                  </p>
                )}
                {addMemberSuccess && (
                  <p className="text-xs text-[#4edea3] bg-[#4edea3]/10 border border-[#4edea3]/20 rounded-lg px-3 py-1.5">
                    ✅ Member added!
                  </p>
                )}
                <button
                  type="submit"
                  disabled={isSavingMember || addMemberSuccess}
                  className="w-full py-2 rounded-lg bg-theme-btn text-white font-semibold text-sm transition-all disabled:opacity-60"
                >
                  {isSavingMember ? 'Adding...' : addMemberSuccess ? '✓ Added!' : 'Add Member'}
                </button>
              </form>

              {/* Divider */}
              <div className="h-px bg-white/5" />

              {/* Members list with delete */}
              <div>
                <h4 className="text-xs font-mono text-[#c2c6d6] uppercase tracking-wider flex items-center gap-2 mb-3">
                  <Trash2 size={13} /> Remove Member
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {profiles.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg bg-[#222a3d]/40 border border-white/5">
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        <AvatarImage src={p.avatar_url || ''} alt={p.name} />
                        <AvatarFallback className="bg-theme-accent-10 text-theme-accent text-xs font-bold">
                          {getInitials(p.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#dae2fd] truncate">{p.name}</p>
                        <p className="text-xs text-[#c2c6d6]/50 truncate">{p.role}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteMember(p.id)}
                        disabled={deletingMemberId === p.id}
                        title="Delete member"
                        className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-[#c2c6d6]/40 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40"
                      >
                        {deletingMemberId === p.id ? (
                          <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin block" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  onClick={() => setSettingsMode('select')}
                  className="px-4 py-2 bg-[#222a3d] hover:bg-[#2d3449] rounded-lg text-sm transition-all"
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
