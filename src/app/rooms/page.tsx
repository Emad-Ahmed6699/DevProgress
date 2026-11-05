'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  supabase,
  Room,
  RoomMember,
  RoomMessage
} from '@/lib/supabase'
import { useProfile } from '@/contexts/ProfileContext'
import Topbar from '@/components/Topbar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  MessagesSquare,
  Send,
  Lock,
  Unlock,
  Key,
  Users,
  CheckCheck,
  Copy,
  Search,
  LogOut,
  Smile,
  ShieldCheck,
  Check,
  MessageCircle,
  ExternalLink,
  X,
  ZoomIn,
  ArrowLeft
} from 'lucide-react'

// Color generator for WhatsApp-like sender names
const SENDER_COLORS = [
  'text-[#38bdf8]', // sky
  'text-[#4ade80]', // green
  'text-[#f472b6]', // pink
  'text-[#fb923c]', // orange
  'text-[#a78bfa]', // purple
  'text-[#facc15]', // yellow
  'text-[#2dd4bf]', // teal
]

function getSenderColor(name: string = '') {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % SENDER_COLORS.length
  return SENDER_COLORS[index]
}

function formatMessageTime(dateStr: string) {
  try {
    const date = new Date(dateStr)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function formatMessageDate(dateStr: string) {
  try {
    const date = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return ''
  }
}

const QUICK_EMOJIS = ['👍', '❤️', '🔥', '😂', '🚀', '🎉', '💻', '👏']

export default function RoomsPage() {
  const { activeProfile } = useProfile()

  // Rooms & State
  const [rooms, setRooms] = useState<Room[]>([])
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null)
  const [roomMemberships, setRoomMemberships] = useState<Set<string>>(new Set())
  const [roomLastMessages, setRoomLastMessages] = useState<Record<string, { content: string; time: string; senderName: string }>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [loadingRooms, setLoadingRooms] = useState(true)

  // Active Chat State
  const [messages, setMessages] = useState<RoomMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [activeRoomMembers, setActiveRoomMembers] = useState<RoomMember[]>([])
  const [showMembersDialog, setShowMembersDialog] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)

  // Join Room by Code Modal & Direct Entry
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false)
  const [inputCode, setInputCode] = useState('')
  const [joinError, setJoinError] = useState('')
  const [isJoining, setIsJoining] = useState(false)

  // Direct locked room unlock input
  const [directCode, setDirectCode] = useState('')
  const [directCodeError, setDirectCodeError] = useState('')

  // WhatsApp-style Photo Lightbox state
  const [previewPhoto, setPreviewPhoto] = useState<{
    isOpen: boolean
    title: string
    subtitle?: string
    imageUrl: string | null
    initials?: string
  } | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewPhoto(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const getInitials = (name: string = '') =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)

  // Auto scroll to bottom
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
  }

  /* ──────────────── Fetch Rooms & Memberships ──────────────── */
  const fetchRoomsAndMemberships = useCallback(async () => {
    setLoadingRooms(true)
    const { data: roomsData } = await supabase
      .from('rooms')
      .select('*')
      .order('created_at', { ascending: false })

    const fetchedRooms = roomsData || []
    setRooms(fetchedRooms)

    // Fetch user memberships
    if (activeProfile) {
      const { data: memberData } = await supabase
        .from('room_members')
        .select('room_id')
        .eq('profile_id', activeProfile.id)

      const joinedSet = new Set((memberData || []).map((m: { room_id: string }) => m.room_id))
      setRoomMemberships(joinedSet)
    }

    // Fetch latest message for each room
    if (fetchedRooms.length > 0) {
      const roomIds = fetchedRooms.map((r) => r.id)
      const { data: recentMsgs } = await supabase
        .from('room_messages')
        .select('room_id, content, created_at, sender:sender_id(name)')
        .in('room_id', roomIds)
        .order('created_at', { ascending: false })

      const lastMap: Record<string, { content: string; time: string; senderName: string }> = {}
      if (recentMsgs) {
        for (const msg of recentMsgs) {
          if (!lastMap[msg.room_id]) {
            const senderObj = Array.isArray(msg.sender) ? msg.sender[0] : msg.sender
            lastMap[msg.room_id] = {
              content: msg.content,
              time: formatMessageTime(msg.created_at),
              senderName: (senderObj as { name?: string })?.name || 'Someone'
            }
          }
        }
      }
      setRoomLastMessages(lastMap)
    }

    setLoadingRooms(false)
  }, [activeProfile])

  useEffect(() => {
    fetchRoomsAndMemberships()
  }, [fetchRoomsAndMemberships])

  /* ──────────────── Fetch Active Room Messages & Members ──────────────── */
  const fetchActiveRoomData = useCallback(async (roomId: string) => {
    // Fetch messages
    const { data: msgData } = await supabase
      .from('room_messages')
      .select('*, sender:sender_id(*)')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })

    if (msgData) {
      setMessages(msgData)
      setTimeout(() => scrollToBottom(false), 80)
    }

    // Fetch room members
    const { data: membersData } = await supabase
      .from('room_members')
      .select('*, profile:profile_id(*)')
      .eq('room_id', roomId)

    if (membersData) {
      setActiveRoomMembers(membersData)
    }
  }, [])

  useEffect(() => {
    if (!activeRoomId) return

    fetchActiveRoomData(activeRoomId)

    // Supabase Realtime subscription for messages in this room
    const channel = supabase
      .channel(`room_chat_${activeRoomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_messages',
          filter: `room_id=eq.${activeRoomId}`
        },
        async (payload) => {
          const newMsg = payload.new as RoomMessage
          // fetch sender details
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', newMsg.sender_id)
            .single()

          const messageWithSender: RoomMessage = {
            ...newMsg,
            sender: senderProfile || undefined
          }

          setMessages((prev) => {
            // avoid duplicate
            if (prev.some((m) => m.id === newMsg.id)) return prev
            return [...prev, messageWithSender]
          })

          // Update last message preview in room list
          setRoomLastMessages((prev) => ({
            ...prev,
            [activeRoomId]: {
              content: newMsg.content,
              time: formatMessageTime(newMsg.created_at),
              senderName: senderProfile?.name || 'Someone'
            }
          }))

          setTimeout(() => scrollToBottom(true), 50)
        }
      )
      .subscribe()

    // Polling backup every 4 seconds to guarantee sync
    const interval = setInterval(() => {
      fetchActiveRoomData(activeRoomId)
    }, 4000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [activeRoomId, fetchActiveRoomData])

  /* ──────────────── Send Message ──────────────── */
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!newMessage.trim() || !activeRoomId || !activeProfile || isSending) return

    const content = newMessage.trim()
    setNewMessage('')
    setIsSending(true)

    // Optimistic message
    const tempId = `temp-${Date.now()}`
    const optimisticMsg: RoomMessage = {
      id: tempId,
      room_id: activeRoomId,
      sender_id: activeProfile.id,
      content,
      created_at: new Date().toISOString(),
      sender: activeProfile
    }
    setMessages((prev) => [...prev, optimisticMsg])
    setTimeout(() => scrollToBottom(true), 50)

    const { data, error } = await supabase
      .from('room_messages')
      .insert({
        room_id: activeRoomId,
        sender_id: activeProfile.id,
        content
      })
      .select('*, sender:sender_id(*)')
      .single()

    if (error) {
      console.error('Failed to send message:', error)
      // Remove optimistic message if failed
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
    } else if (data) {
      // Replace optimistic with real
      setMessages((prev) => prev.map((m) => (m.id === tempId ? data : m)))
      setRoomLastMessages((prev) => ({
        ...prev,
        [activeRoomId]: {
          content,
          time: formatMessageTime(data.created_at),
          senderName: activeProfile.name
        }
      }))
    }
    setIsSending(false)
  }

  /* ──────────────── Join with Room Code (Direct on Locked Room) ──────────────── */
  const handleDirectUnlock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeRoom || !activeProfile || !directCode.trim()) return

    setDirectCodeError('')
    const entered = directCode.trim()

    if (entered.toLowerCase() !== activeRoom.code.trim().toLowerCase()) {
      setDirectCodeError('Incorrect room code. Please try again.')
      return
    }

    setIsJoining(true)
    const { error } = await supabase.from('room_members').upsert({
      room_id: activeRoom.id,
      profile_id: activeProfile.id
    })

    if (error) {
      setDirectCodeError(error.message)
    } else {
      setRoomMemberships((prev) => {
        const next = new Set(prev)
        next.add(activeRoom.id)
        return next
      })
      setDirectCode('')
      await fetchActiveRoomData(activeRoom.id)
    }
    setIsJoining(false)
  }

  /* ──────────────── Join Room by Code (Top Modal) ──────────────── */
  const handleJoinByCodeModal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputCode.trim() || !activeProfile) return

    setJoinError('')
    setIsJoining(true)

    const codeToFind = inputCode.trim()
    const targetRoom = rooms.find(
      (r) => r.code.trim().toLowerCase() === codeToFind.toLowerCase()
    )

    if (!targetRoom) {
      setJoinError('No room found with this code. Check the code and try again.')
      setIsJoining(false)
      return
    }

    const { error } = await supabase.from('room_members').upsert({
      room_id: targetRoom.id,
      profile_id: activeProfile.id
    })

    if (error) {
      setJoinError(error.message)
    } else {
      setRoomMemberships((prev) => {
        const next = new Set(prev)
        next.add(targetRoom.id)
        return next
      })
      setActiveRoomId(targetRoom.id)
      setIsJoinModalOpen(false)
      setInputCode('')
      await fetchActiveRoomData(targetRoom.id)
    }
    setIsJoining(false)
  }

  /* ──────────────── Leave Room ──────────────── */
  const handleLeaveRoom = async () => {
    if (!activeRoomId || !activeProfile) return
    const confirmed = window.confirm('Are you sure you want to leave this room?')
    if (!confirmed) return

    await supabase
      .from('room_members')
      .delete()
      .eq('room_id', activeRoomId)
      .eq('profile_id', activeProfile.id)

    setRoomMemberships((prev) => {
      const next = new Set(prev)
      next.delete(activeRoomId)
      return next
    })
    setShowMembersDialog(false)
  }

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const activeRoom = rooms.find((r) => r.id === activeRoomId) || null
  const isJoinedActiveRoom = activeRoomId ? roomMemberships.has(activeRoomId) : false

  const filteredRooms = rooms.filter((r) =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#080d1a]">
      {/* Topbar */}
      <Topbar
        searchPlaceholder="Search rooms..."
        onSearch={(val) => setSearchQuery(val)}
      />

      {/* Main WhatsApp-style layout */}
      <div className="flex flex-1 mt-16 overflow-hidden">
        {/* ──────── Left Column: Rooms Sidebar ──────── */}
        <div
          className={`w-full md:w-[380px] flex-shrink-0 flex flex-col border-r border-white/10 bg-[#0f172a]/80 backdrop-blur-md ${
            activeRoom ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Rooms Header */}
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-theme-accent-10 flex items-center justify-center text-theme-accent border border-theme-accent/20">
                <MessagesSquare size={18} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#dae2fd]">Squad Rooms</h2>
                <p className="text-[10px] text-[#c2c6d6]/60 font-mono">
                  {rooms.length} {rooms.length === 1 ? 'room' : 'rooms'} available
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setJoinError('')
                setInputCode('')
                setIsJoinModalOpen(true)
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-theme-btn text-white text-xs font-semibold hover:opacity-90 transition-all shadow-sm"
              title="Enter room code to join"
            >
              <Key size={13} />
              <span>Join with Code</span>
            </button>
          </div>

          {/* Search Bar inside sidebar */}
          <div className="p-3 border-b border-white/5">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c2c6d6]/50" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search rooms..."
                className="pl-8 h-8 bg-[#1e293b]/50 border-white/5 text-xs text-[#dae2fd] placeholder:text-[#c2c6d6]/40 rounded-lg"
              />
            </div>
          </div>

          {/* Rooms List */}
          <div className="flex-1 overflow-y-auto divide-y divide-white/[0.03]">
            {loadingRooms ? (
              <div className="flex items-center justify-center py-12 text-[#c2c6d6]/50 text-xs">
                <span className="w-4 h-4 border-2 border-theme-accent border-t-transparent rounded-full animate-spin mr-2" />
                Loading rooms...
              </div>
            ) : filteredRooms.length === 0 ? (
              <div className="text-center py-12 px-4">
                <MessageCircle size={32} className="mx-auto text-[#c2c6d6]/30 mb-2" />
                <p className="text-xs font-medium text-[#c2c6d6]/70">No rooms found</p>
                <p className="text-[11px] text-[#c2c6d6]/40 mt-1">
                  Create a room in Settings &gt; Manage Rooms or try another search.
                </p>
              </div>
            ) : (
              filteredRooms.map((room) => {
                const isSelected = room.id === activeRoomId
                const isJoined = roomMemberships.has(room.id)
                const lastMsg = roomLastMessages[room.id]

                return (
                  <button
                    key={room.id}
                    onClick={() => {
                      setActiveRoomId(room.id)
                      setDirectCode('')
                      setDirectCodeError('')
                    }}
                    className={`w-full text-left p-3.5 flex items-center gap-3 transition-all relative ${
                      isSelected
                        ? 'bg-theme-accent-10 border-l-4 border-theme-accent'
                        : 'hover:bg-white/[0.03] border-l-4 border-transparent'
                    }`}
                  >
                    {/* Room Avatar */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation()
                        setPreviewPhoto({
                          isOpen: true,
                          title: room.name,
                          subtitle: isJoined ? 'Squad Room' : 'Protected Room',
                          imageUrl: room.image_url,
                          initials: getInitials(room.name)
                        })
                      }}
                      className="relative flex-shrink-0 group/avatar cursor-pointer"
                      title="Click to view room photo"
                    >
                      <Avatar className="w-12 h-12 rounded-2xl border border-white/10 shadow-sm group-hover/avatar:border-theme-accent group-hover/avatar:scale-105 transition-all">
                        <AvatarImage src={room.image_url || ''} alt={room.name} />
                        <AvatarFallback className="bg-[#1e293b] text-theme-accent text-sm font-bold rounded-2xl">
                          {getInitials(room.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <ZoomIn size={14} />
                      </div>
                      <div
                        className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-[#0f172a] flex items-center justify-center z-10 ${
                          isJoined ? 'bg-[#4edea3]' : 'bg-[#f59e0b]'
                        }`}
                        title={isJoined ? 'Joined' : 'Locked (Requires Code)'}
                      >
                        {isJoined ? (
                          <Check size={9} className="text-black stroke-[3]" />
                        ) : (
                          <Lock size={8} className="text-black stroke-[2.5]" />
                        )}
                      </div>
                    </div>

                    {/* Room Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <h3 className={`text-sm font-semibold truncate ${isSelected ? 'text-theme-accent' : 'text-[#dae2fd]'}`}>
                          {room.name}
                        </h3>
                        {lastMsg && (
                          <span className="text-[10px] text-[#c2c6d6]/50 font-mono flex-shrink-0">
                            {lastMsg.time}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs text-[#c2c6d6]/60">
                        <p className="truncate text-[11px] pr-2" dir="auto">
                          {lastMsg ? (
                            <span>
                              <span className="text-[#dae2fd]/70 font-medium">{lastMsg.senderName}: </span>
                              <span>{lastMsg.content}</span>
                            </span>
                          ) : (
                            <span className="italic text-[#c2c6d6]/40">
                              {room.description || 'No messages yet'}
                            </span>
                          )}
                        </p>

                        {!isJoined && (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 flex-shrink-0">
                            Code
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* ──────── Right Column: WhatsApp Chat Area ──────── */}
        <div
          className={`flex-1 flex flex-col bg-[#0b1326] relative overflow-hidden ${
            !activeRoom ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* No Room Selected State */}
          {!activeRoom ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#080d1a]/50">
              <div className="w-20 h-20 rounded-3xl bg-theme-accent-10 border border-theme-accent/20 flex items-center justify-center text-theme-accent mb-5 shadow-2xl">
                <MessagesSquare size={40} />
              </div>
              <h2 className="text-2xl font-bold text-[#dae2fd] mb-2">DevProgress Squad Rooms</h2>
              <p className="text-sm text-[#c2c6d6]/60 max-w-md leading-relaxed mb-6">
                Real-time group discussions with your technical squad. Select a room from the left to start chatting, or join with an access code.
              </p>
              <button
                onClick={() => {
                  setJoinError('')
                  setInputCode('')
                  setIsJoinModalOpen(true)
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-theme-btn text-white font-semibold text-sm hover:opacity-95 transition-all shadow-lg"
              >
                <Key size={16} />
                <span>Join Room with Access Code</span>
              </button>
            </div>
          ) : !isJoinedActiveRoom ? (
            /* Locked Room State (Code Required) */
            <div className="flex-1 flex items-center justify-center p-6 bg-[#080d1a]/60">
              <div className="w-full max-w-md p-8 rounded-3xl bg-[#171f33] border border-white/10 shadow-2xl text-center space-y-6">
                <div
                  onClick={() =>
                    setPreviewPhoto({
                      isOpen: true,
                      title: activeRoom.name,
                      subtitle: 'Protected Squad Room',
                      imageUrl: activeRoom.image_url,
                      initials: getInitials(activeRoom.name)
                    })
                  }
                  className="relative mx-auto w-24 h-24 cursor-pointer group"
                  title="Click to view full photo"
                >
                  <Avatar className="w-24 h-24 rounded-3xl border-2 border-white/10 shadow-xl group-hover:scale-105 group-hover:border-theme-accent transition-all">
                    <AvatarImage src={activeRoom.image_url || ''} alt={activeRoom.name} />
                    <AvatarFallback className="bg-theme-accent-10 text-theme-accent text-2xl font-bold rounded-3xl">
                      {getInitials(activeRoom.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 bg-black/40 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                    <ZoomIn size={22} />
                  </div>
                  <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-amber-500 text-black flex items-center justify-center shadow-lg border-2 border-[#171f33] z-10">
                    <Lock size={15} className="stroke-[2.5]" />
                  </div>
                </div>

                <div>
                  <h2 className="text-xl font-bold text-[#dae2fd]">{activeRoom.name}</h2>
                  {activeRoom.description && (
                    <p className="text-xs text-[#c2c6d6]/60 mt-1 max-w-sm mx-auto">
                      {activeRoom.description}
                    </p>
                  )}
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-3 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-mono">
                    <ShieldCheck size={13} />
                    <span>Protected Squad Room</span>
                  </div>
                </div>

                <form onSubmit={handleDirectUnlock} className="space-y-4">
                  <div>
                    <label className="text-[11px] font-mono text-[#c2c6d6]/70 uppercase tracking-widest block mb-2 text-left">
                      Enter Room Access Code
                    </label>
                    <div className="relative">
                      <Key size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c2c6d6]/40" />
                      <Input
                        type="text"
                        required
                        value={directCode}
                        onChange={(e) => setDirectCode(e.target.value)}
                        placeholder="e.g. FE2024"
                        className="pl-9 bg-[#222a3d] border-white/10 text-[#dae2fd] font-mono tracking-wider h-11 text-center text-sm"
                      />
                    </div>
                  </div>

                  {directCodeError && (
                    <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">
                      ❌ {directCodeError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={isJoining || !directCode.trim()}
                    className="w-full py-2.5 rounded-xl bg-theme-btn text-white font-semibold text-sm transition-all hover:opacity-95 disabled:opacity-50 shadow-md flex items-center justify-center gap-2"
                  >
                    {isJoining ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Unlock size={16} />
                        <span>Unlock & Enter Room</span>
                      </>
                    )}
                  </button>
                </form>

                <p className="text-[11px] text-[#c2c6d6]/40">
                  Don&apos;t have the code? Ask the room administrator or team lead.
                </p>
              </div>
            </div>
          ) : (
            /* Joined WhatsApp Chat State */
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* WhatsApp Chat Header */}
              <div className="h-16 px-3 sm:px-5 border-b border-white/10 bg-[#171f33]/90 backdrop-blur-md flex items-center justify-between flex-shrink-0 z-10">
                <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
                  <button
                    onClick={() => setActiveRoomId(null)}
                    className="md:hidden p-1.5 rounded-lg text-[#c2c6d6] hover:text-white hover:bg-white/5 transition-colors -ml-1"
                    title="Back to rooms list"
                    aria-label="Back to rooms list"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <div
                    onClick={() =>
                      setPreviewPhoto({
                        isOpen: true,
                        title: activeRoom.name,
                        subtitle: `${activeRoomMembers.length} squad members`,
                        imageUrl: activeRoom.image_url,
                        initials: getInitials(activeRoom.name)
                      })
                    }
                    className="flex items-center gap-2.5 sm:gap-3 min-w-0 cursor-pointer group/header select-none"
                    title="Click to view full photo"
                  >
                  <div className="relative flex-shrink-0">
                    <Avatar className="w-11 h-11 rounded-2xl border border-white/10 group-hover/header:border-theme-accent group-hover/header:scale-105 transition-all shadow-md">
                      <AvatarImage src={activeRoom.image_url || ''} alt={activeRoom.name} />
                      <AvatarFallback className="bg-theme-accent-10 text-theme-accent text-sm font-bold rounded-2xl">
                        {getInitials(activeRoom.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover/header:opacity-100 transition-opacity flex items-center justify-center text-white">
                      <ZoomIn size={14} />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-[#dae2fd] group-hover/header:text-theme-accent transition-colors truncate">
                      {activeRoom.name}
                    </h3>
                    <p className="text-[11px] text-[#c2c6d6]/60 truncate font-mono">
                      {activeRoomMembers.length > 0
                        ? activeRoomMembers.map((m) => m.profile?.name).filter(Boolean).join(', ')
                        : 'Squad Members'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                  {/* Copy Code Pill */}
                  <button
                    type="button"
                    onClick={() => handleCopyCode(activeRoom.code)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#222a3d] hover:bg-[#2d3449] border border-white/5 text-xs font-mono text-theme-accent transition-all"
                    title="Copy room code to invite members"
                  >
                    <Key size={12} />
                    <span>#{activeRoom.code}</span>
                    {copiedCode ? (
                      <CheckCheck size={12} className="text-[#4edea3]" />
                    ) : (
                      <Copy size={12} className="opacity-60" />
                    )}
                  </button>

                  {/* Members Button */}
                  <button
                    onClick={() => setShowMembersDialog(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#222a3d] hover:bg-[#2d3449] border border-white/5 text-xs text-[#dae2fd] transition-all"
                    title="View room members"
                  >
                    <Users size={14} />
                    <span>{activeRoomMembers.length}</span>
                  </button>
                </div>
              </div>

              {/* Messages Body (WhatsApp background style) */}
              <div
                className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4"
                style={{
                  backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px)`,
                  backgroundSize: '20px 20px',
                  backgroundColor: '#0a0f1d'
                }}
              >
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-12">
                    <div className="w-14 h-14 rounded-2xl bg-theme-accent-10 flex items-center justify-center text-theme-accent mb-3 border border-theme-accent/20">
                      <Smile size={28} />
                    </div>
                    <p className="text-sm font-semibold text-[#dae2fd]">No messages yet</p>
                    <p className="text-xs text-[#c2c6d6]/50 max-w-xs mt-1">
                      Be the first to say hello to the group! Messages appear instantly for everyone in the room.
                    </p>
                  </div>
                ) : (
                  messages.map((msg, index) => {
                    const isMe = msg.sender_id === activeProfile?.id
                    const showDateSeparator =
                      index === 0 ||
                      formatMessageDate(msg.created_at) !== formatMessageDate(messages[index - 1].created_at)

                    const senderName = msg.sender?.name || (isMe ? activeProfile?.name : 'Squad Member') || 'Member'

                    return (
                      <div key={msg.id} className="space-y-3">
                        {/* Date Separator */}
                        {showDateSeparator && (
                          <div className="flex justify-center my-3">
                            <span className="px-3 py-1 rounded-full bg-[#1e293b]/80 border border-white/5 text-[10px] font-mono text-[#c2c6d6]/70 shadow-sm">
                              {formatMessageDate(msg.created_at)}
                            </span>
                          </div>
                        )}

                        {/* Message Bubble Container */}
                        <div className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                          {/* Sender Avatar for others */}
                          {!isMe && (
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewPhoto({
                                  isOpen: true,
                                  title: senderName,
                                  subtitle: msg.sender?.role || 'Squad Member',
                                  imageUrl: msg.sender?.avatar_url || null,
                                  initials: getInitials(senderName)
                                })
                              }
                              className="focus:outline-none flex-shrink-0 mb-1 group/msg cursor-pointer"
                              title={`View ${senderName}'s photo`}
                            >
                              <Avatar className="w-8 h-8 rounded-xl border border-white/10 group-hover/msg:border-theme-accent group-hover/msg:scale-105 transition-all">
                                <AvatarImage src={msg.sender?.avatar_url || ''} alt={senderName} />
                                <AvatarFallback className="bg-theme-accent-10 text-theme-accent text-[10px] font-bold rounded-xl">
                                  {getInitials(senderName)}
                                </AvatarFallback>
                              </Avatar>
                            </button>
                          )}

                          {/* Bubble */}
                          <div
                            className={`max-w-[78%] md:max-w-[65%] rounded-2xl px-4 py-2.5 shadow-md relative group transition-all ${
                              isMe
                                ? 'bg-gradient-to-r from-theme-accent-10 to-theme-accent-20 border border-theme-accent/40 text-white rounded-br-none'
                                : 'bg-[#1e293b]/90 border border-white/10 text-[#dae2fd] rounded-bl-none'
                            }`}
                          >
                            {/* Sender Name in Group Chat */}
                            {!isMe && (
                              <p className={`text-[11px] font-bold mb-1 ${getSenderColor(senderName)}`}>
                                {senderName}
                              </p>
                            )}

                            {/* Message Content */}
                            <p
                              dir="auto"
                              className="text-sm leading-relaxed whitespace-pre-wrap break-words text-start"
                            >
                              {msg.content}
                            </p>

                            {/* Time & Double Checkmark */}
                            <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-[#c2c6d6]/60">
                              <span>{formatMessageTime(msg.created_at)}</span>
                              {isMe && (
                                <CheckCheck size={13} className="text-theme-accent stroke-[2.5]" />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Emojis Bar */}
              <div className="px-4 py-1.5 bg-[#171f33]/60 border-t border-white/5 flex items-center gap-1 overflow-x-auto">
                <span className="text-[10px] font-mono text-[#c2c6d6]/40 uppercase tracking-widest mr-1">Quick:</span>
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setNewMessage((prev) => prev + emoji)}
                    className="hover:scale-125 px-1 text-sm transition-transform"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Message Input Bar (WhatsApp style) */}
              <form
                onSubmit={handleSendMessage}
                className="p-3 bg-[#171f33] border-t border-white/10 flex items-center gap-3 flex-shrink-0"
              >
                <div className="relative flex-1">
                  <Input
                    dir="auto"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSendMessage()
                      }
                    }}
                    placeholder={`Type a message as ${activeProfile?.name || 'Member'}...`}
                    className="bg-[#222a3d] border-white/10 text-sm text-[#dae2fd] placeholder:text-[#c2c6d6]/30 h-11 px-4 rounded-xl focus:ring-2 focus:ring-theme-accent/50"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!newMessage.trim() || isSending}
                  className="w-11 h-11 rounded-xl bg-theme-btn text-white flex items-center justify-center hover:opacity-90 transition-all disabled:opacity-40 flex-shrink-0 shadow-md"
                  title="Send message"
                >
                  <Send size={16} />
                </button>
              </form>

              {/* Profile hint footer */}
              <div className="px-4 py-1 bg-[#101726] border-t border-white/5 flex items-center justify-between text-[10px] text-[#c2c6d6]/50 font-mono">
                <span>Sending as: <strong className="text-theme-accent">{activeProfile?.name}</strong></span>
                <span>💡 Switch profiles from the sidebar to chat as someone else</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ──────── Modal: Join Room by Code ──────── */}
      <Dialog open={isJoinModalOpen} onOpenChange={setIsJoinModalOpen}>
        <DialogContent className="bg-[#171f33] border border-white/10 text-[#dae2fd] max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-theme-accent text-lg flex items-center gap-2">
              <Key size={18} /> Join Room with Access Code
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleJoinByCodeModal} className="space-y-4 pt-2">
            <p className="text-xs text-[#c2c6d6]/70 leading-relaxed">
              Enter the unique secret code given by the room admin to unlock and join the group chat.
            </p>

            <div>
              <label className="text-[10px] font-mono text-[#c2c6d6]/60 uppercase tracking-widest block mb-1">
                Room Access Code *
              </label>
              <Input
                required
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                placeholder="e.g. FE2024"
                className="bg-[#222a3d] border-white/5 text-[#dae2fd] font-mono tracking-wider h-9"
              />
            </div>

            {joinError && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2">
                ❌ {joinError}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsJoinModalOpen(false)}
                className="flex-1 py-2 rounded-lg bg-[#222a3d] hover:bg-[#2d3449] text-xs transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isJoining || !inputCode.trim()}
                className="flex-1 py-2 rounded-lg bg-theme-btn text-white font-semibold text-xs transition-all disabled:opacity-50"
              >
                {isJoining ? 'Joining...' : 'Join Room'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ──────── Modal: Room Members List ──────── */}
      <Dialog open={showMembersDialog} onOpenChange={setShowMembersDialog}>
        <DialogContent className="bg-[#171f33] border border-white/10 text-[#dae2fd] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-theme-accent text-lg flex items-center gap-2">
              <Users size={18} /> {activeRoom?.name} — Squad Members ({activeRoomMembers.length})
            </DialogTitle>
          </DialogHeader>

          <div className="py-2 space-y-4">
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {activeRoomMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-[#222a3d]/40 border border-white/5"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewPhoto({
                        isOpen: true,
                        title: member.profile?.name || 'Member',
                        subtitle: member.profile?.role || 'Squad Member',
                        imageUrl: member.profile?.avatar_url || null,
                        initials: getInitials(member.profile?.name)
                      })
                    }}
                    className="flex-shrink-0 cursor-pointer group/m focus:outline-none"
                    title="Click to view full photo"
                  >
                    <Avatar className="w-10 h-10 rounded-xl border border-white/5 group-hover/m:border-theme-accent group-hover/m:scale-105 transition-all shadow">
                      <AvatarImage src={member.profile?.avatar_url || ''} alt={member.profile?.name} />
                      <AvatarFallback className="bg-theme-accent-10 text-theme-accent text-xs font-bold rounded-xl">
                        {getInitials(member.profile?.name)}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#dae2fd] truncate">
                      {member.profile?.name}
                      {member.profile_id === activeProfile?.id && (
                        <span className="text-[10px] text-theme-accent font-mono ml-2">(You)</span>
                      )}
                    </p>
                    <p className="text-xs text-[#c2c6d6]/50 truncate">{member.profile?.role}</p>
                  </div>
                  <span className="text-[10px] font-mono text-[#c2c6d6]/40">
                    {new Date(member.joined_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-white/5 flex items-center justify-between">
              <button
                type="button"
                onClick={handleLeaveRoom}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition-all"
              >
                <LogOut size={13} />
                <span>Leave Room</span>
              </button>

              <button
                type="button"
                onClick={() => setShowMembersDialog(false)}
                className="px-4 py-1.5 rounded-lg bg-[#222a3d] hover:bg-[#2d3449] text-xs transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ──────── WhatsApp-style Profile / Room Photo Lightbox ──────── */}
      {previewPhoto?.isOpen && (
        <div
          onClick={() => setPreviewPhoto(null)}
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col items-center justify-between p-4 sm:p-6 select-none animate-in fade-in duration-200"
        >
          {/* Top Bar */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl flex items-center justify-between pb-3 border-b border-white/10"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="w-10 h-10 rounded-2xl border border-white/10 flex-shrink-0">
                <AvatarImage src={previewPhoto.imageUrl || ''} alt={previewPhoto.title} />
                <AvatarFallback className="bg-theme-accent-10 text-theme-accent text-sm font-bold rounded-2xl">
                  {previewPhoto.initials || getInitials(previewPhoto.title)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-white truncate">{previewPhoto.title}</h3>
                {previewPhoto.subtitle && (
                  <p className="text-xs text-[#c2c6d6]/60 font-mono truncate">{previewPhoto.subtitle}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {previewPhoto.imageUrl && (
                <a
                  href={previewPhoto.imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-mono flex items-center gap-1.5 transition-colors"
                  title="Open image in new tab"
                >
                  <ExternalLink size={14} />
                  <span className="hidden sm:inline">Full Image</span>
                </a>
              )}
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-red-500/80 text-white flex items-center justify-center transition-colors"
                title="Close (Esc)"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Centered High-Res Photo Container */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex-1 w-full max-w-3xl flex items-center justify-center my-auto p-2"
          >
            {previewPhoto.imageUrl ? (
              <div className="relative group max-w-full max-h-[75vh] flex items-center justify-center">
                <img
                  src={previewPhoto.imageUrl}
                  alt={previewPhoto.title}
                  className="max-w-full max-h-[72vh] w-auto h-auto rounded-2xl md:rounded-3xl shadow-2xl border border-white/10 object-contain object-center ring-1 ring-white/10 bg-[#0f172a]"
                />
              </div>
            ) : (
              <div className="w-72 h-72 md:w-80 md:h-80 rounded-3xl bg-[#171f33] border border-white/10 flex flex-col items-center justify-center text-theme-accent shadow-2xl p-6 text-center">
                <div className="w-24 h-24 rounded-2xl bg-theme-accent-10 border border-theme-accent/20 flex items-center justify-center text-3xl font-bold mb-4">
                  {previewPhoto.initials || getInitials(previewPhoto.title)}
                </div>
                <h4 className="text-lg font-bold text-[#dae2fd]">{previewPhoto.title}</h4>
                <p className="text-xs text-[#c2c6d6]/50 mt-1">No custom photo uploaded</p>
              </div>
            )}
          </div>

          {/* Bottom Hint */}
          <div className="text-center pt-2">
            <span className="text-[11px] text-[#c2c6d6]/40 font-mono bg-white/5 px-3 py-1 rounded-full border border-white/5">
              Click anywhere outside or press Esc to close
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
