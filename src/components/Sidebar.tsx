'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  BookOpen,
  Users,
  Settings,
  ChevronDown,
  Check,
  Lock,
  Palette,
  UserPlus,
  Trash2,
  Library,
  MessagesSquare,
  Hash,
  Key,
  Copy,
  CheckCheck,
  Pencil,
  Upload,
  X,
  Camera
} from 'lucide-react'
import { useProfile } from '@/contexts/ProfileContext'
import { supabase, Profile, Room } from '@/lib/supabase'
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
import Logo from '@/components/Logo'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/courses', label: 'Courses', icon: BookOpen },
  { href: '/team', label: 'Team Members', icon: Users },
  { href: '/resources', label: 'Resources', icon: Library },
  { href: '/rooms', label: 'Rooms', icon: MessagesSquare },
]

const themes = {
  blue: {
    name: 'Neon Blue',
    class: 'bg-blue-600',
    color: '#4876e1',
    glow: 'rgba(45, 32, 139, 0.3)',
    glowStrong: 'rgba(13, 99, 237, 0.5)',
    shadow: 'rgba(59, 130, 246, 0.2)',
    btnStart: '#447ee2',
    btnEnd: '#0c0cde'
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
    color: '#6b39c2',
    glow: 'rgba(250, 255, 192, 0.18)',
    glowStrong: 'rgba(249, 192, 255, 0.67)',
    shadow: 'rgba(255, 247, 192, 0.2)',
    btnStart: '#c0edff',
    btnEnd: '#af63f1'
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
  const [settingsMode, setSettingsMode] = useState<'select' | 'theme' | 'login' | 'manage' | 'manage-rooms'>('select')
  const [targetManageMode, setTargetManageMode] = useState<'manage' | 'manage-rooms'>('manage')
  const [isAdminVerified, setIsAdminVerified] = useState(false)
  const [activeTheme, setActiveTheme] = useState<keyof typeof themes>('blue')

  // Login states
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')

  // Member management states (Add & Edit)
  const [editingMember, setEditingMember] = useState<Profile | null>(null)
  const [memberName, setMemberName] = useState('')
  const [memberRole, setMemberRole] = useState('')
  const [memberAvatarUrl, setMemberAvatarUrl] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [isSavingMember, setIsSavingMember] = useState(false)
  const [memberError, setMemberError] = useState('')
  const [memberSuccess, setMemberSuccess] = useState('')
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null)
  const memberFileInputRef = useRef<HTMLInputElement>(null)

  // Room management states
  const [roomsList, setRoomsList] = useState<Room[]>([])
  const [newRoomName, setNewRoomName] = useState('')
  const [newRoomCode, setNewRoomCode] = useState('')
  const [newRoomImage, setNewRoomImage] = useState('')
  const [roomImageFile, setRoomImageFile] = useState<File | null>(null)
  const [roomImagePreview, setRoomImagePreview] = useState('')
  const [newRoomDescription, setNewRoomDescription] = useState('')
  const [isSavingRoom, setIsSavingRoom] = useState(false)
  const [addRoomError, setAddRoomError] = useState('')
  const [addRoomSuccess, setAddRoomSuccess] = useState(false)
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null)
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null)
  const roomFileInputRef = useRef<HTMLInputElement>(null)

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

  const fetchRooms = useCallback(async () => {
    const { data } = await supabase
      .from('rooms')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) {
      setRoomsList(data)
    }
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

  useEffect(() => {
    if (settingsMode === 'manage-rooms') {
      fetchRooms()
    }
  }, [settingsMode, fetchRooms])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (email === 'emadahmed@gmail.com' && password === 'emadahmed') {
      setIsAdminVerified(true)
      setSettingsMode(targetManageMode)
      if (targetManageMode === 'manage-rooms') {
        fetchRooms()
      }
      setLoginError('')
      setEmail('')
      setPassword('')
    } else {
      setLoginError('Incorrect email or password.')
    }
  }

  const uploadImageFile = async (file: File, folder = 'avatars'): Promise<string> => {
    const fileExt = file.name.split('.').pop() || 'png'
    const fileName = `${folder}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { contentType: file.type, upsert: true })

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`)
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName)
    return urlData.publicUrl
  }

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setAvatarFile(file)
      setAvatarPreview(URL.createObjectURL(file))
      setMemberAvatarUrl('')
    }
  }

  const handleRemoveAvatar = () => {
    setAvatarFile(null)
    setAvatarPreview('')
    setMemberAvatarUrl('')
    if (memberFileInputRef.current) memberFileInputRef.current.value = ''
  }

  const handleStartEditMember = (p: Profile) => {
    setEditingMember(p)
    setMemberName(p.name)
    setMemberRole(p.role)
    setMemberAvatarUrl(p.avatar_url || '')
    setAvatarPreview(p.avatar_url || '')
    setAvatarFile(null)
    setMemberError('')
    setMemberSuccess('')
    if (memberFileInputRef.current) memberFileInputRef.current.value = ''
  }

  const handleCancelEdit = () => {
    setEditingMember(null)
    setMemberName('')
    setMemberRole('')
    setMemberAvatarUrl('')
    setAvatarPreview('')
    setAvatarFile(null)
    setMemberError('')
    setMemberSuccess('')
    if (memberFileInputRef.current) memberFileInputRef.current.value = ''
  }

  const handleSaveMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!memberName.trim() || !memberRole.trim()) return
    setIsSavingMember(true)
    setMemberError('')
    setMemberSuccess('')

    try {
      let finalAvatarUrl: string | null = memberAvatarUrl.trim() || null

      if (avatarFile) {
        finalAvatarUrl = await uploadImageFile(avatarFile, 'avatar')
      } else if (!avatarPreview) {
        finalAvatarUrl = null
      }

      if (editingMember) {
        const { error } = await supabase
          .from('profiles')
          .update({
            name: memberName.trim(),
            role: memberRole.trim(),
            avatar_url: finalAvatarUrl,
          })
          .eq('id', editingMember.id)

        if (error) throw error

        setMemberSuccess('Member updated successfully!')
        handleCancelEdit()
      } else {
        const insertData: Record<string, unknown> = {
          name: memberName.trim(),
          role: memberRole.trim(),
          status: 'Active',
          avatar_url: finalAvatarUrl,
        }

        const { error } = await supabase.from('profiles').insert(insertData)
        if (error) throw error

        setMemberSuccess('Member added successfully!')
        setMemberName('')
        setMemberRole('')
        setMemberAvatarUrl('')
        setAvatarPreview('')
        setAvatarFile(null)
        if (memberFileInputRef.current) memberFileInputRef.current.value = ''
      }

      await Promise.all([fetchSidebarMembers(), refreshProfiles()])
      setTimeout(() => setMemberSuccess(''), 2500)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save member'
      setMemberError(msg)
    } finally {
      setIsSavingMember(false)
    }
  }

  const handleDeleteMember = async (profileId: string) => {
    if (deletingMemberId) return
    setDeletingMemberId(profileId)
    try {
      await supabase.from('activities').delete().eq('user_id', profileId)
      await supabase.from('tasks').update({ assignee_id: null }).eq('assignee_id', profileId)
      const { error } = await supabase.from('profiles').delete().eq('id', profileId)
      if (!error) {
        if (activeProfile?.id === profileId && profiles.length > 1) {
          const next = profiles.find((p) => p.id !== profileId)
          if (next) setActiveProfile(next)
        }
        if (editingMember?.id === profileId) {
          handleCancelEdit()
        }
        await Promise.all([fetchSidebarMembers(), refreshProfiles()])
      }
    } finally {
      setDeletingMemberId(null)
    }
  }

  const handleRoomImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setRoomImageFile(file)
      setRoomImagePreview(URL.createObjectURL(file))
      setNewRoomImage('')
    }
  }

  const handleRemoveRoomImage = () => {
    setRoomImageFile(null)
    setRoomImagePreview('')
    setNewRoomImage('')
    if (roomFileInputRef.current) roomFileInputRef.current.value = ''
  }

  const handleAddRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRoomName.trim() || !newRoomCode.trim()) return
    setIsSavingRoom(true)
    setAddRoomError('')
    setAddRoomSuccess(false)

    try {
      let finalRoomImage: string | null = newRoomImage.trim() || null
      if (roomImageFile) {
        finalRoomImage = await uploadImageFile(roomImageFile, 'room')
      }

      const insertData: Record<string, unknown> = {
        name: newRoomName.trim(),
        code: newRoomCode.trim(),
      }
      if (finalRoomImage) insertData.image_url = finalRoomImage
      if (newRoomDescription.trim()) insertData.description = newRoomDescription.trim()
      if (activeProfile?.id) insertData.created_by = activeProfile.id

      const { data, error } = await supabase.from('rooms').insert(insertData).select()
      if (error) throw error

      if (data && data[0] && activeProfile?.id) {
        await supabase.from('room_members').upsert({
          room_id: data[0].id,
          profile_id: activeProfile.id
        })
      }

      setAddRoomSuccess(true)
      setNewRoomName('')
      setNewRoomCode('')
      setNewRoomImage('')
      setNewRoomDescription('')
      handleRemoveRoomImage()
      await fetchRooms()
      setTimeout(() => setAddRoomSuccess(false), 2000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create room'
      setAddRoomError(msg)
    } finally {
      setIsSavingRoom(false)
    }
  }

  const handleDeleteRoom = async (roomId: string) => {
    if (deletingRoomId) return
    setDeletingRoomId(roomId)
    try {
      await supabase.from('room_messages').delete().eq('room_id', roomId)
      await supabase.from('room_members').delete().eq('room_id', roomId)
      const { error } = await supabase.from('rooms').delete().eq('id', roomId)
      if (!error) {
        await fetchRooms()
      }
    } finally {
      setDeletingRoomId(null)
    }
  }

  const handleCopyCode = (roomId: string, code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCodeId(roomId)
    setTimeout(() => setCopiedCodeId(null), 2000)
  }

  return (
    <>
      <aside className="w-[280px] h-screen fixed left-0 top-0 flex flex-col py-6 z-50 border-r border-white/10 bg-[#0b1326]/60 backdrop-blur-lg">
        {/* Logo */}
        <div className="px-6 mb-8 flex items-center gap-3">
          <Logo size={32} />
          <div>
            <h1 className="text-2xl font-bold text-theme-accent tracking-tight">DevProgress</h1>
            <p className="text-xs text-[#c2c6d6]/70 mt-0.5 font-mono">Technical Progression</p>
          </div>
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
        <DialogContent
          className={`bg-[#171f33] border border-white/10 text-[#dae2fd] transition-all duration-200 ${
            settingsMode === 'select'
              ? 'max-w-[540px] sm:max-w-[540px]'
              : 'max-w-lg sm:max-w-lg'
          }`}
        >
          <DialogHeader>
            <DialogTitle className="text-theme-accent text-xl">Settings & Customization</DialogTitle>
          </DialogHeader>

          {/* ── SELECT ── */}
          {settingsMode === 'select' && (
            <div className="grid grid-cols-3 gap-3 py-4">
              <button
                onClick={() => setSettingsMode('theme')}
                className="flex flex-col items-center justify-center gap-3.5 py-5 px-3 rounded-2xl border border-white/5 bg-[#222a3d]/30 hover:border-theme-accent/50 hover:bg-[#222a3d]/60 transition-all text-center group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-xl bg-theme-accent-10 flex items-center justify-center text-theme-accent group-hover:scale-105 transition-transform">
                  <Palette size={24} />
                </div>
                <span className="font-semibold text-sm whitespace-nowrap">Customize Theme</span>
              </button>

              <button
                onClick={() => {
                  if (isAdminVerified) {
                    setSettingsMode('manage')
                  } else {
                    setTargetManageMode('manage')
                    setSettingsMode('login')
                  }
                }}
                className="flex flex-col items-center justify-center gap-3.5 py-5 px-3 rounded-2xl border border-white/5 bg-[#222a3d]/30 hover:border-theme-accent/50 hover:bg-[#222a3d]/60 transition-all text-center group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-xl bg-theme-accent-10 flex items-center justify-center text-theme-accent group-hover:scale-105 transition-transform">
                  <UserPlus size={24} />
                </div>
                <span className="font-semibold text-sm whitespace-nowrap">Manage Members</span>
              </button>

              <button
                onClick={() => {
                  if (isAdminVerified) {
                    setSettingsMode('manage-rooms')
                    fetchRooms()
                  } else {
                    setTargetManageMode('manage-rooms')
                    setSettingsMode('login')
                  }
                }}
                className="flex flex-col items-center justify-center gap-3.5 py-5 px-3 rounded-2xl border border-white/5 bg-[#222a3d]/30 hover:border-theme-accent/50 hover:bg-[#222a3d]/60 transition-all text-center group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-xl bg-theme-accent-10 flex items-center justify-center text-theme-accent group-hover:scale-105 transition-transform">
                  <MessagesSquare size={24} />
                </div>
                <span className="font-semibold text-sm whitespace-nowrap">Manage Rooms</span>
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
                <h4 className="text-xs font-mono text-[#c2c6d6] uppercase tracking-wider">
                  Admin Verification ({targetManageMode === 'manage-rooms' ? 'Rooms' : 'Members'})
                </h4>
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
              {/* Add / Edit Member Form */}
              <form onSubmit={handleSaveMemberSubmit} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-mono text-[#c2c6d6] uppercase tracking-wider flex items-center gap-2">
                    {editingMember ? (
                      <>
                        <Pencil size={13} className="text-theme-accent" /> Edit Member
                      </>
                    ) : (
                      <>
                        <UserPlus size={13} /> Add New Member
                      </>
                    )}
                  </h4>
                  {editingMember && (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="text-[11px] text-[#c2c6d6]/60 hover:text-white flex items-center gap-1 transition-colors"
                    >
                      <X size={12} /> Cancel
                    </button>
                  )}
                </div>

                {/* Name & Role */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-mono text-[#c2c6d6]/60 uppercase tracking-widest mb-1 block">Name *</label>
                    <Input
                      required
                      value={memberName}
                      onChange={(e) => setMemberName(e.target.value)}
                      placeholder="Full name"
                      className="bg-[#222a3d] border-white/5 text-[#dae2fd] text-sm h-8"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-[#c2c6d6]/60 uppercase tracking-widest mb-1 block">Role *</label>
                    <Input
                      required
                      value={memberRole}
                      onChange={(e) => setMemberRole(e.target.value)}
                      placeholder="e.g. Backend Dev"
                      className="bg-[#222a3d] border-white/5 text-[#dae2fd] text-sm h-8"
                    />
                  </div>
                </div>

                {/* Avatar upload from device */}
                <div>
                  <label className="text-[10px] font-mono text-[#c2c6d6]/60 uppercase tracking-widest mb-1 block">
                    Member Photo / Avatar
                  </label>
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#222a3d]/50 border border-white/5">
                    <div className="relative w-14 h-14 flex-shrink-0">
                      <Avatar className="w-14 h-14 rounded-2xl border-2 border-white/10 shadow-md">
                        <AvatarImage src={avatarPreview || memberAvatarUrl || ''} alt="Avatar" />
                        <AvatarFallback className="bg-theme-accent-10 text-theme-accent text-sm font-bold rounded-2xl">
                          {memberName ? getInitials(memberName) : '?'}
                        </AvatarFallback>
                      </Avatar>
                      {(avatarPreview || memberAvatarUrl) && (
                        <button
                          type="button"
                          onClick={handleRemoveAvatar}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-all shadow z-10"
                          title="Remove image"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <input
                        ref={memberFileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarFileChange}
                        className="hidden"
                        id="member-avatar-upload"
                      />
                      <label
                        htmlFor="member-avatar-upload"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#171f33] hover:bg-[#20293d] border border-white/10 text-xs text-[#dae2fd] cursor-pointer transition-all shadow-sm"
                      >
                        <Upload size={13} className="text-theme-accent" />
                        <span>{avatarFile ? 'Change Image from Device' : 'Upload from Device'}</span>
                      </label>
                      <p className="text-[10px] text-[#c2c6d6]/50 mt-1 truncate">
                        {avatarFile ? avatarFile.name : 'Choose a JPG, PNG, or WebP file from your computer'}
                      </p>
                    </div>
                  </div>
                </div>

                {memberError && (
                  <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5">
                    ❌ {memberError}
                  </p>
                )}
                {memberSuccess && (
                  <p className="text-xs text-[#4edea3] bg-[#4edea3]/10 border border-[#4edea3]/20 rounded-lg px-3 py-1.5">
                    ✅ {memberSuccess}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={isSavingMember || Boolean(memberSuccess)}
                  className="w-full py-2 rounded-lg bg-theme-btn text-white font-semibold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isSavingMember ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{editingMember ? 'Saving Changes...' : 'Adding Member...'}</span>
                    </>
                  ) : memberSuccess ? (
                    '✓ Saved!'
                  ) : editingMember ? (
                    'Save Changes'
                  ) : (
                    'Add Member'
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="h-px bg-white/5" />

              {/* Members list with Edit and Delete */}
              <div>
                <h4 className="text-xs font-mono text-[#c2c6d6] uppercase tracking-wider flex items-center gap-2 mb-3">
                  <Users size={13} /> Manage Members ({profiles.length})
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {profiles.map((p) => {
                    const isBeingEdited = editingMember?.id === p.id
                    return (
                      <div
                        key={p.id}
                        className={`flex items-center gap-3 p-2 rounded-lg border transition-all ${
                          isBeingEdited
                            ? 'bg-theme-accent-10 border-theme-accent/40'
                            : 'bg-[#222a3d]/40 border-white/5'
                        }`}
                      >
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
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEditMember(p)}
                            title="Edit member"
                            className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${
                              isBeingEdited
                                ? 'text-theme-accent bg-theme-accent/20'
                                : 'text-[#c2c6d6]/50 hover:text-theme-accent hover:bg-white/5'
                            }`}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMember(p.id)}
                            disabled={deletingMemberId === p.id}
                            title="Delete member"
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#c2c6d6]/40 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40"
                          >
                            {deletingMemberId === p.id ? (
                              <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin block" />
                            ) : (
                              <Trash2 size={13} />
                            )}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  onClick={() => {
                    handleCancelEdit()
                    setSettingsMode('select')
                  }}
                  className="px-4 py-2 bg-[#222a3d] hover:bg-[#2d3449] rounded-lg text-sm transition-all"
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {/* ── MANAGE ROOMS ── */}
          {settingsMode === 'manage-rooms' && (
            <div className="py-2 space-y-5">
              {/* Add Room Form */}
              <form onSubmit={handleAddRoomSubmit} className="space-y-3">
                <h4 className="text-xs font-mono text-[#c2c6d6] uppercase tracking-wider flex items-center gap-2">
                  <MessagesSquare size={13} /> Add New Room
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-mono text-[#c2c6d6]/60 uppercase tracking-widest mb-1 block">Room Name *</label>
                    <Input
                      required
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                      placeholder="e.g. Frontend Squad"
                      className="bg-[#222a3d] border-white/5 text-[#dae2fd] text-sm h-8"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-[#c2c6d6]/60 uppercase tracking-widest mb-1 block">Access Code *</label>
                    <Input
                      required
                      value={newRoomCode}
                      onChange={(e) => setNewRoomCode(e.target.value)}
                      placeholder="e.g. FE2024"
                      className="bg-[#222a3d] border-white/5 text-[#dae2fd] text-sm h-8 font-mono"
                    />
                  </div>
                </div>

                {/* Room Image from device or URL */}
                <div>
                  <label className="text-[10px] font-mono text-[#c2c6d6]/60 uppercase tracking-widest mb-1 block">
                    Room Image / Icon
                  </label>
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#222a3d]/50 border border-white/5">
                    <div className="relative w-14 h-14 flex-shrink-0">
                      <Avatar className="w-14 h-14 rounded-2xl border-2 border-white/10 shadow-md">
                        <AvatarImage src={roomImagePreview || newRoomImage || ''} alt="Room" />
                        <AvatarFallback className="bg-theme-accent-10 text-theme-accent text-sm font-bold rounded-2xl">
                          {newRoomName ? newRoomName.slice(0, 2).toUpperCase() : '#'}
                        </AvatarFallback>
                      </Avatar>
                      {(roomImagePreview || newRoomImage) && (
                        <button
                          type="button"
                          onClick={handleRemoveRoomImage}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-all shadow z-10"
                          title="Remove image"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <input
                        ref={roomFileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleRoomImageChange}
                        className="hidden"
                        id="room-image-upload"
                      />
                      <label
                        htmlFor="room-image-upload"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#171f33] hover:bg-[#20293d] border border-white/10 text-xs text-[#dae2fd] cursor-pointer transition-all shadow-sm"
                      >
                        <Upload size={13} className="text-theme-accent" />
                        <span>{roomImageFile ? 'Change Image from Device' : 'Upload from Device'}</span>
                      </label>
                      <p className="text-[10px] text-[#c2c6d6]/50 mt-1 truncate">
                        {roomImageFile ? roomImageFile.name : 'PNG, JPG, or WebP image for the room'}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-mono text-[#c2c6d6]/60 uppercase tracking-widest mb-1 block">Description (optional)</label>
                  <Input
                    value={newRoomDescription}
                    onChange={(e) => setNewRoomDescription(e.target.value)}
                    placeholder="e.g. General chat for discussions and updates"
                    className="bg-[#222a3d] border-white/5 text-[#dae2fd] text-sm h-8"
                  />
                </div>

                {addRoomError && (
                  <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5">
                    ❌ {addRoomError}
                  </p>
                )}
                {addRoomSuccess && (
                  <p className="text-xs text-[#4edea3] bg-[#4edea3]/10 border border-[#4edea3]/20 rounded-lg px-3 py-1.5">
                    ✅ Room created successfully!
                  </p>
                )}
                <button
                  type="submit"
                  disabled={isSavingRoom || addRoomSuccess}
                  className="w-full py-2 rounded-lg bg-theme-btn text-white font-semibold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isSavingRoom ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Creating Room...</span>
                    </>
                  ) : addRoomSuccess ? (
                    '✓ Created!'
                  ) : (
                    'Create Room'
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="h-px bg-white/5" />

              {/* Existing Rooms List */}
              <div>
                <h4 className="text-xs font-mono text-[#c2c6d6] uppercase tracking-wider flex items-center justify-between mb-3">
                  <span className="flex items-center gap-2">
                    <Hash size={13} /> Existing Rooms ({roomsList.length})
                  </span>
                </h4>
                {roomsList.length === 0 ? (
                  <p className="text-xs text-[#c2c6d6]/40 italic py-2 text-center">No rooms created yet.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {roomsList.map((room) => (
                      <div key={room.id} className="flex items-center gap-3 p-2 rounded-lg bg-[#222a3d]/40 border border-white/5">
                        <Avatar className="w-8 h-8 rounded-lg flex-shrink-0">
                          <AvatarImage src={room.image_url || ''} alt={room.name} />
                          <AvatarFallback className="bg-theme-accent-10 text-theme-accent text-xs font-bold rounded-lg">
                            {room.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-[#dae2fd] truncate">{room.name}</p>
                            <button
                              type="button"
                              onClick={() => handleCopyCode(room.id, room.code)}
                              title="Copy Room Code"
                              className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[10px] font-mono text-theme-accent flex items-center gap-1 transition-all"
                            >
                              <Key size={10} />
                              <span>{room.code}</span>
                              {copiedCodeId === room.id ? (
                                <CheckCheck size={10} className="text-[#4edea3]" />
                              ) : (
                                <Copy size={10} className="opacity-60" />
                              )}
                            </button>
                          </div>
                          {room.description && (
                            <p className="text-xs text-[#c2c6d6]/50 truncate">{room.description}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteRoom(room.id)}
                          disabled={deletingRoomId === room.id}
                          title="Delete room"
                          className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-[#c2c6d6]/40 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40"
                        >
                          {deletingRoomId === room.id ? (
                            <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin block" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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
