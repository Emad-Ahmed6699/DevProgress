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
  ArrowLeft,
  Camera,
  Pencil,
  Trash2
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
const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏']

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

  // Photo upload in chat state
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file.')
      return
    }
    setSelectedImageFile(file)
    const preview = URL.createObjectURL(file)
    setImagePreviewUrl(preview)
  }

  const handleClearImage = () => {
    setSelectedImageFile(null)
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl)
      setImagePreviewUrl(null)
    }
    if (imageInputRef.current) {
      imageInputRef.current.value = ''
    }
  }

  // Edit message state
  const [editingMessage, setEditingMessage] = useState<RoomMessage | null>(null)
  const [preEditText, setPreEditText] = useState('')
  const messageInputRef = useRef<HTMLInputElement>(null)

  const startEditingMessage = (msg: RoomMessage) => {
    setEditingMessage(msg)
    setPreEditText(newMessage)
    setNewMessage(msg.content || '')
    setTimeout(() => {
      messageInputRef.current?.focus()
    }, 50)
  }

  const cancelEditingMessage = useCallback(() => {
    setEditingMessage(null)
    setNewMessage(preEditText)
    setPreEditText('')
  }, [preEditText])

  // Delete message confirmation state (WhatsApp custom modal)
  const [messageToDeleteId, setMessageToDeleteId] = useState<string | null>(null)

  const handleConfirmDelete = async (msgId: string) => {
    setMessageToDeleteId(null)
    setActiveMenuMessageId(null)

    // Optimistic removal
    setMessages((prev) => prev.filter((m) => m.id !== msgId))

    const { error } = await supabase
      .from('room_messages')
      .delete()
      .eq('id', msgId)

    if (error) {
      console.error('Failed to delete message:', error)
      alert('Failed to delete message: ' + error.message)
      if (activeRoomId) fetchActiveRoomData(activeRoomId)
    }
  }

  // Active message popup menu (WhatsApp style: long press on mobile, click on laptop)
  const [activeMenuMessageId, setActiveMenuMessageId] = useState<string | null>(null)
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const touchMovedRef = useRef<boolean>(false)

  const handleTouchStart = (msgId: string) => {
    touchMovedRef.current = false
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = setTimeout(() => {
      if (!touchMovedRef.current) {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try {
            navigator.vibrate(40)
          } catch {}
        }
        setActiveMenuMessageId(msgId)
      }
    }, 450)
  }

  const handleTouchMove = () => {
    touchMovedRef.current = true
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const handleBubbleClick = (e: React.MouseEvent, msgId: string) => {
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('[data-photo-preview]')) {
      return
    }
    setActiveMenuMessageId((prev) => (prev === msgId ? null : msgId))
  }

  const handleContextMenu = (e: React.MouseEvent, msgId: string) => {
    e.preventDefault()
    setActiveMenuMessageId(msgId)
  }

  const hasReacted = (msg: RoomMessage, emoji: string) => {
    if (!activeProfile?.id || !msg.reactions) return false
    const userIds = msg.reactions[emoji] || []
    return userIds.includes(activeProfile.id)
  }

  const handleToggleReaction = async (msgId: string, emoji: string) => {
    if (!activeProfile?.id) return
    const userId = activeProfile.id

    const msg = messages.find((m) => m.id === msgId)
    if (!msg) return

    const currentReactions: Record<string, string[]> = {}
    if (msg.reactions) {
      Object.entries(msg.reactions).forEach(([eKey, uList]) => {
        if (Array.isArray(uList)) {
          currentReactions[eKey] = [...uList]
        }
      })
    }

    const userList = currentReactions[emoji] || []
    const alreadyReacted = userList.includes(userId)

    // In WhatsApp, reacting with emoji toggles it or replaces previous reaction
    Object.keys(currentReactions).forEach((key) => {
      currentReactions[key] = currentReactions[key].filter((id) => id !== userId)
      if (currentReactions[key].length === 0) {
        delete currentReactions[key]
      }
    })

    if (!alreadyReacted) {
      currentReactions[emoji] = [...(currentReactions[emoji] || []), userId]
    }

    // Optimistic UI update
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, reactions: currentReactions } : m))
    )

    const { error } = await supabase
      .from('room_messages')
      .update({ reactions: currentReactions })
      .eq('id', msgId)

    if (error) {
      console.error('Failed to update reactions:', error)
      if (activeRoomId) fetchActiveRoomData(activeRoomId)
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (messageToDeleteId) {
          setMessageToDeleteId(null)
        } else if (activeMenuMessageId) {
          setActiveMenuMessageId(null)
        } else if (previewPhoto) {
          setPreviewPhoto(null)
        } else if (editingMessage) {
          cancelEditingMessage()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [previewPhoto, editingMessage, cancelEditingMessage, activeMenuMessageId, messageToDeleteId])

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
          event: '*',
          schema: 'public',
          table: 'room_messages',
          filter: `room_id=eq.${activeRoomId}`
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
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
                content: newMsg.content || (newMsg.image_url ? '📷 Photo' : ''),
                time: formatMessageTime(newMsg.created_at),
                senderName: senderProfile?.name || 'Someone'
              }
            }))

            setTimeout(() => scrollToBottom(true), 50)
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as RoomMessage
            setMessages((prev) =>
              prev.map((m) => (m.id === updated.id ? { ...m, ...updated, sender: m.sender } : m))
            )
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id: string }
            setMessages((prev) => prev.filter((m) => m.id !== deleted.id))
          }
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

  /* ──────────────── Send / Edit Message ──────────────── */
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!activeRoomId || !activeProfile || isSending) return

    // If editing existing message
    if (editingMessage) {
      if (!newMessage.trim()) return
      const updatedText = newMessage.trim()
      const editingId = editingMessage.id

      // Optimistic update
      setMessages((prev) =>
        prev.map((m) =>
          m.id === editingId ? { ...m, content: updatedText, is_edited: true } : m
        )
      )
      setEditingMessage(null)
      setNewMessage('')
      setPreEditText('')

      const { error } = await supabase
        .from('room_messages')
        .update({
          content: updatedText,
          is_edited: true
        })
        .eq('id', editingId)

      if (error) {
        console.error('Failed to update message:', error)
        alert('Failed to update message: ' + error.message)
        if (activeRoomId) fetchActiveRoomData(activeRoomId)
      }
      return
    }

    if (!newMessage.trim() && !selectedImageFile) return

    const content = newMessage.trim()
    const currentImageFile = selectedImageFile
    const currentPreviewUrl = imagePreviewUrl

    // Clear inputs immediately
    setNewMessage('')
    handleClearImage()
    setIsSending(true)

    // Optimistic message
    const tempId = `temp-${Date.now()}`
    const optimisticMsg: RoomMessage = {
      id: tempId,
      room_id: activeRoomId,
      sender_id: activeProfile.id,
      content,
      image_url: currentPreviewUrl,
      created_at: new Date().toISOString(),
      sender: activeProfile
    }
    setMessages((prev) => [...prev, optimisticMsg])
    setTimeout(() => scrollToBottom(true), 50)

    try {
      let uploadedImageUrl: string | null = null

      // Upload image to Supabase if attached
      if (currentImageFile) {
        const fileExt = currentImageFile.name.split('.').pop() || 'png'
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`
        const filePath = `chat/${activeRoomId}/${fileName}`

        let { data: uploadData, error: uploadErr } = await supabase.storage
          .from('chat-images')
          .upload(filePath, currentImageFile)

        if (uploadErr) {
          // Fallback to avatars bucket
          const fallback = await supabase.storage
            .from('avatars')
            .upload(filePath, currentImageFile)
          uploadData = fallback.data
          uploadErr = fallback.error
        }

        if (uploadData) {
          const { data: urlData } = supabase.storage
            .from(uploadErr ? 'avatars' : 'chat-images')
            .getPublicUrl(uploadData.path)
          uploadedImageUrl = urlData.publicUrl
        }
      }

      const { data, error } = await supabase
        .from('room_messages')
        .insert({
          room_id: activeRoomId,
          sender_id: activeProfile.id,
          content,
          image_url: uploadedImageUrl
        })
        .select('*, sender:sender_id(*)')
        .single()

      if (error) {
        console.error('Failed to send message:', error)
        setMessages((prev) => prev.filter((m) => m.id !== tempId))
      } else if (data) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? data : m)))
        setRoomLastMessages((prev) => ({
          ...prev,
          [activeRoomId]: {
            content: content || '📷 Photo',
            time: formatMessageTime(data.created_at),
            senderName: activeProfile.name
          }
        }))
      }
    } catch (err) {
      console.error('Failed to send message:', err)
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
    } finally {
      setIsSending(false)
    }
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
                        <div className={`flex items-end gap-1.5 sm:gap-2 ${isMe ? 'justify-end' : 'justify-start'} group/row relative`}>
                          {/* Desktop Hover Quick Actions (Reaction trigger + Edit/Delete for author) */}
                          <div
                            className={`hidden sm:flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity mb-1 bg-[#131c2e]/90 backdrop-blur-sm border border-white/10 rounded-xl p-0.5 shadow-sm ${
                              isMe ? 'order-first' : 'order-last'
                            }`}
                          >
                            {/* Emoji reaction button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setActiveMenuMessageId((prev) => (prev === msg.id ? null : msg.id))
                              }}
                              className="w-7 h-7 rounded-lg hover:bg-white/10 text-[#c2c6d6] hover:text-white flex items-center justify-center transition-colors"
                              title="React with emoji"
                            >
                              <Smile size={14} />
                            </button>

                            {isMe && msg.content && (
                              <button
                                type="button"
                                onClick={() => startEditingMessage(msg)}
                                className="w-7 h-7 rounded-lg hover:bg-theme-accent-10 text-[#c2c6d6] hover:text-theme-accent flex items-center justify-center transition-colors"
                                title="Edit message"
                              >
                                <Pencil size={13} />
                              </button>
                            )}
                            {isMe && (
                              <button
                                type="button"
                                onClick={() => setMessageToDeleteId(msg.id)}
                                className="w-7 h-7 rounded-lg hover:bg-rose-500/20 text-[#c2c6d6] hover:text-rose-400 flex items-center justify-center transition-colors"
                                title="Delete message"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>

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

                          {/* Bubble Wrapper with Floating Menu anchor */}
                          <div className="relative max-w-[85%] sm:max-w-[75%] md:max-w-[65%]">
                            {/* Floating WhatsApp Menu (Reactions + Edit / Delete) */}
                            {activeMenuMessageId === msg.id && (
                              <>
                                {/* Backdrop to close on click outside */}
                                <div
                                  className="fixed inset-0 z-40"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setActiveMenuMessageId(null)
                                  }}
                                />

                                {/* WhatsApp-style Popup: renders below bubble if first message (to prevent header clipping), or above for subsequent */}
                                <div
                                  className={`absolute ${index === 0 ? 'top-full mt-2' : 'bottom-full mb-2'} z-50 flex flex-col gap-1.5 animate-in zoom-in-95 fade-in duration-150 ${
                                    isMe ? 'right-0 items-end' : 'left-0 items-start'
                                  }`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {/* Famous Emojis Reaction Bar */}
                                  <div className="bg-[#1e293b]/95 backdrop-blur-md border border-white/15 rounded-full px-2.5 py-1.5 shadow-2xl flex items-center gap-1.5">
                                    {REACTION_EMOJIS.map((emoji) => {
                                      const isMine = hasReacted(msg, emoji)
                                      return (
                                        <button
                                          key={emoji}
                                          type="button"
                                          onClick={() => {
                                            handleToggleReaction(msg.id, emoji)
                                            setActiveMenuMessageId(null)
                                          }}
                                          className={`text-xl hover:scale-135 active:scale-90 transition-transform p-1 rounded-full cursor-pointer ${
                                            isMine ? 'bg-white/20 scale-110 ring-1 ring-white/30' : 'hover:bg-white/10'
                                          }`}
                                          title={`React with ${emoji}`}
                                        >
                                          {emoji}
                                        </button>
                                      )
                                    })}
                                  </div>

                                  {/* Edit & Delete Actions Menu (for author) */}
                                  {isMe && (
                                    <div className="bg-[#171f33]/95 backdrop-blur-md border border-white/15 rounded-2xl shadow-2xl p-1 flex flex-col gap-0.5 min-w-[140px]">
                                      {msg.content && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActiveMenuMessageId(null)
                                            startEditingMessage(msg)
                                          }}
                                          className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#dae2fd] hover:text-white hover:bg-white/10 rounded-xl transition-colors text-left cursor-pointer"
                                        >
                                          <Pencil size={13} className="text-theme-accent" />
                                          <span>Edit Message</span>
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveMenuMessageId(null)
                                          setMessageToDeleteId(msg.id)
                                        }}
                                        className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-colors text-left cursor-pointer"
                                      >
                                        <Trash2 size={13} />
                                        <span>Delete Message</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </>
                            )}

                            {/* Message Bubble with Long-Press on Mobile and Click on Desktop */}
                            <div
                              onTouchStart={() => handleTouchStart(msg.id)}
                              onTouchMove={handleTouchMove}
                              onTouchEnd={handleTouchEnd}
                              onTouchCancel={handleTouchEnd}
                              onClick={(e) => handleBubbleClick(e, msg.id)}
                              onContextMenu={(e) => handleContextMenu(e, msg.id)}
                              className={`rounded-2xl p-2 shadow-md relative group transition-all select-none cursor-pointer ${
                                isMe
                                  ? 'bg-gradient-to-r from-theme-accent-10 to-theme-accent-20 border border-theme-accent/40 text-white rounded-br-none'
                                  : 'bg-[#1e293b]/90 border border-white/10 text-[#dae2fd] rounded-bl-none'
                              } ${activeMenuMessageId === msg.id ? 'ring-2 ring-theme-accent shadow-xl scale-[1.01]' : ''}`}
                            >
                              {/* Sender Name in Group Chat */}
                              {!isMe && (
                                <p className={`text-[11px] font-bold px-2 pt-1 mb-1 ${getSenderColor(senderName)}`}>
                                  {senderName}
                                </p>
                              )}

                              {/* Image if present */}
                              {msg.image_url && (
                                <div
                                  data-photo-preview
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setPreviewPhoto({
                                      isOpen: true,
                                      title: senderName,
                                      subtitle: formatMessageTime(msg.created_at),
                                      imageUrl: msg.image_url || null,
                                      initials: getInitials(senderName)
                                    })
                                  }}
                                  className="relative rounded-xl overflow-hidden cursor-pointer group/img mb-1 bg-black/30"
                                >
                                  <img
                                    src={msg.image_url}
                                    alt="Shared photo"
                                    className="w-full max-h-72 object-cover rounded-xl group-hover/img:scale-[1.01] transition-transform duration-200"
                                  />
                                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white gap-1.5 text-xs font-semibold">
                                    <ZoomIn size={16} />
                                    <span>View Photo</span>
                                  </div>
                                </div>
                              )}

                              {/* Message Content */}
                              {msg.content && (
                                <p
                                  dir="auto"
                                  className="text-sm leading-relaxed whitespace-pre-wrap break-words px-2 py-0.5 text-start"
                                >
                                  {msg.content}
                                </p>
                              )}

                              {/* Time & Double Checkmark */}
                              <div className="flex items-center justify-end gap-1 px-2 pb-0.5 mt-0.5 text-[10px] text-[#c2c6d6]/60">
                                {msg.is_edited && (
                                  <span className="text-[9px] italic text-theme-accent/80 font-mono mr-0.5">edited</span>
                                )}
                                <span>{formatMessageTime(msg.created_at)}</span>
                                {isMe && (
                                  <CheckCheck size={13} className="text-theme-accent stroke-[2.5]" />
                                )}
                              </div>
                            </div>

                            {/* Reactions Badges underneath the bubble */}
                            {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                              <div className={`flex flex-wrap items-center gap-1 mt-1 ${isMe ? 'justify-end mr-1' : 'justify-start ml-1'}`}>
                                {Object.entries(msg.reactions).map(([emoji, userIds]) => {
                                  if (!userIds || userIds.length === 0) return null
                                  const isMyReaction = activeProfile?.id ? userIds.includes(activeProfile.id) : false
                                  return (
                                    <button
                                      key={emoji}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleToggleReaction(msg.id, emoji)
                                      }}
                                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border shadow-sm transition-all hover:scale-110 active:scale-95 cursor-pointer ${
                                        isMyReaction
                                          ? 'bg-theme-accent-10 border-theme-accent/50 text-theme-accent font-semibold ring-1 ring-theme-accent/30'
                                          : 'bg-[#151c2e] border-white/10 text-[#c2c6d6] hover:bg-white/5'
                                      }`}
                                      title={`${userIds.length} ${userIds.length === 1 ? 'reaction' : 'reactions'}`}
                                    >
                                      <span className="text-sm">{emoji}</span>
                                      {userIds.length > 1 && <span className="text-[10px] font-mono font-bold">{userIds.length}</span>}
                                    </button>
                                  )
                                })}
                              </div>
                            )}
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

              {/* Image Preview Banner if photo attached */}
              {imagePreviewUrl && (
                <div className="p-3 bg-[#131c2e] border-t border-white/10 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 duration-150">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-white/20 bg-black/40 flex-shrink-0">
                      <img
                        src={imagePreviewUrl}
                        alt="Upload preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[#dae2fd] truncate">
                        {selectedImageFile?.name || 'Photo attached'}
                      </p>
                      <p className="text-[10px] text-[#4edea3] font-mono">
                        Ready to send • Add optional caption below
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearImage}
                    className="p-1.5 rounded-lg text-[#c2c6d6] hover:text-red-400 hover:bg-white/5 transition-colors"
                    title="Remove attached photo"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              {/* Editing Banner */}
              {editingMessage && (
                <div className="px-4 py-2 bg-[#131c2e] border-t-2 border-theme-accent flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 duration-150">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-theme-accent-10 flex items-center justify-center text-theme-accent flex-shrink-0 border border-theme-accent/30">
                      <Pencil size={13} />
                    </div>
                    <div className="min-w-0 text-xs">
                      <p className="font-semibold text-theme-accent flex items-center gap-1.5">
                        <span>Editing message</span>
                        <span className="text-[10px] text-[#c2c6d6]/60 font-normal">(Enter to save, Esc to cancel)</span>
                      </p>
                      <p className="text-[#c2c6d6]/80 truncate max-w-xs sm:max-w-md">
                        {editingMessage.content}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={cancelEditingMessage}
                    className="p-1.5 rounded-lg text-[#c2c6d6] hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1 text-xs"
                    title="Cancel edit (Esc)"
                  >
                    <X size={15} />
                    <span className="hidden sm:inline">Cancel</span>
                  </button>
                </div>
              )}

              {/* Message Input Bar (WhatsApp style) */}
              <form
                onSubmit={handleSendMessage}
                className="p-3 bg-[#171f33] border-t border-white/10 flex items-center gap-2 sm:gap-3 flex-shrink-0"
              >
                {/* Hidden File Input */}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />

                {/* Attach Photo Button */}
                {!editingMessage && (
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all flex-shrink-0 border ${
                      selectedImageFile
                        ? 'bg-theme-accent-10 text-theme-accent border-theme-accent/50'
                        : 'bg-[#222a3d] text-[#c2c6d6] hover:text-white border-white/10 hover:bg-white/5'
                    }`}
                    title="Attach Photo"
                  >
                    <Camera size={18} />
                  </button>
                )}

                <div className="relative flex-1">
                  <Input
                    ref={messageInputRef}
                    dir="auto"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSendMessage()
                      }
                      if (e.key === 'Escape' && editingMessage) {
                        cancelEditingMessage()
                      }
                    }}
                    placeholder={
                      editingMessage
                        ? 'Edit message... (Enter to save, Esc to cancel)'
                        : selectedImageFile
                        ? 'Add a caption (optional)...'
                        : `Type a message as ${activeProfile?.name || 'Member'}...`
                    }
                    className={`bg-[#222a3d] border-white/10 text-sm text-[#dae2fd] placeholder:text-[#c2c6d6]/30 h-11 px-4 rounded-xl focus:ring-2 focus:ring-theme-accent/50 ${
                      editingMessage ? 'border-theme-accent/50 bg-theme-accent-10/10' : ''
                    }`}
                  />
                </div>

                <button
                  type="submit"
                  disabled={(!newMessage.trim() && !selectedImageFile) || isSending}
                  className="w-11 h-11 rounded-xl bg-theme-btn text-white flex items-center justify-center hover:opacity-90 transition-all disabled:opacity-40 flex-shrink-0 shadow-md"
                  title={editingMessage ? 'Save changes' : 'Send message'}
                >
                  {isSending ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : editingMessage ? (
                    <Check size={18} className="stroke-[3]" />
                  ) : (
                    <Send size={16} />
                  )}
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

      {/* ──────── Modal: Delete Message Confirmation (WhatsApp style) ──────── */}
      <Dialog open={!!messageToDeleteId} onOpenChange={(open) => !open && setMessageToDeleteId(null)}>
        <DialogContent className="bg-[#171f33] border border-white/10 text-[#dae2fd] max-w-sm rounded-2xl p-6 shadow-2xl">
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mb-4 shadow-lg shadow-rose-500/10">
              <Trash2 size={24} />
            </div>
            <h3 className="text-base font-bold text-[#dae2fd] mb-2">Delete message?</h3>
            <p className="text-xs text-[#c2c6d6]/70 leading-relaxed mb-6">
              Are you sure you want to delete this message? This action cannot be undone and will remove it for everyone in the room.
            </p>

            <div className="flex items-center gap-3 w-full">
              <button
                type="button"
                onClick={() => setMessageToDeleteId(null)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-[#dae2fd] font-medium text-xs transition-colors border border-white/10 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (messageToDeleteId) {
                    handleConfirmDelete(messageToDeleteId)
                  }
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs transition-colors shadow-lg shadow-rose-600/30 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 size={14} />
                <span>Delete for everyone</span>
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
