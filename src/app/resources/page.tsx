'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase, Resource, ResourceType, Course, Profile } from '@/lib/supabase'
import { useProfile } from '@/contexts/ProfileContext'
import Topbar from '@/components/Topbar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Heart, Plus, ExternalLink, Video, GitBranch, BookOpen, FileText, Package,
  Filter, Bookmark,
} from 'lucide-react'

/* ─────────── helpers ─────────── */

const TYPE_META: Record<ResourceType, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  video:   { label: 'Video',   icon: Video,      color: 'text-[#ff4e4e]',  bg: 'bg-[#ff4e4e]/10' },
  github:  { label: 'GitHub',  icon: GitBranch,  color: 'text-[#dae2fd]',  bg: 'bg-white/10'     },
  book:    { label: 'Book',    icon: BookOpen,   color: 'text-[#4edea3]',  bg: 'bg-[#4edea3]/10' },
  article: { label: 'Article', icon: FileText,   color: 'text-[#adc6ff]',  bg: 'bg-[#adc6ff]/10' },
  other:   { label: 'Other',   icon: Package,    color: 'text-[#c0c1ff]',  bg: 'bg-[#c0c1ff]/10' },
}

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function getDomain(url: string) {
  try { return new URL(url).hostname.replace('www.', '') } catch { return url }
}

/* ─────────── default form ─────────── */

interface ResourceForm {
  title: string
  url: string
  description: string
  type: ResourceType
  course_id: string
}

const DEFAULT_FORM: ResourceForm = {
  title: '',
  url: '',
  description: '',
  type: 'article',
  course_id: '',
}

/* ─────────── page ─────────── */

export default function ResourcesPage() {
  const { activeProfile } = useProfile()

  const [resources, setResources] = useState<(Resource & { author?: Profile; course?: Course })[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<ResourceForm>(DEFAULT_FORM)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | ResourceType>('all')

  /* ── fetch ── */
  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [resRes, coursesRes] = await Promise.all([
      supabase
        .from('resources')
        .select('*, author:added_by(*), course:course_id(*)')
        .order('created_at', { ascending: false }),
      supabase.from('courses').select('id, title').order('title'),
    ])
    setResources(resRes.data || [])
    setCourses((coursesRes.data as Course[]) || [])

    if (activeProfile) {
      const { data: likesData } = await supabase
        .from('resource_likes')
        .select('resource_id')
        .eq('profile_id', activeProfile.id)
      setLikedIds(new Set((likesData || []).map((l: { resource_id: string }) => l.resource_id)))
    }
    setLoading(false)
  }, [activeProfile])

  useEffect(() => { fetchAll() }, [fetchAll])

  /* ── submit ── */
  const handleSubmit = async () => {
    if (!form.title.trim() || !form.url.trim()) return
    setSaving(true)
    const { error } = await supabase.from('resources').insert({
      title: form.title.trim(),
      url: form.url.trim(),
      description: form.description || null,
      type: form.type,
      course_id: (form.course_id && form.course_id !== 'none') ? form.course_id : null,
      added_by: activeProfile?.id || null,
      likes: 0,
    })
    if (!error) {
      setForm(DEFAULT_FORM)
      setOpen(false)
      fetchAll()
    } else {
      alert('Error sharing resource: ' + error.message)
    }
    setSaving(false)
  }

  /* ── like ── */
  const handleLike = async (resourceId: string) => {
    if (!activeProfile) return
    const alreadyLiked = likedIds.has(resourceId)

    // Optimistic UI
    setLikedIds(prev => {
      const next = new Set(prev)
      if (alreadyLiked) {
        next.delete(resourceId)
      } else {
        next.add(resourceId)
      }
      return next
    })
    setResources(prev =>
      prev.map(r =>
        r.id === resourceId ? { ...r, likes: r.likes + (alreadyLiked ? -1 : 1) } : r,
      ),
    )

    if (alreadyLiked) {
      await supabase
        .from('resource_likes')
        .delete()
        .eq('resource_id', resourceId)
        .eq('profile_id', activeProfile.id)
      await supabase
        .from('resources')
        .update({ likes: (resources.find(r => r.id === resourceId)?.likes ?? 1) - 1 })
        .eq('id', resourceId)
    } else {
      await supabase.from('resource_likes').insert({ resource_id: resourceId, profile_id: activeProfile.id })
      await supabase
        .from('resources')
        .update({ likes: (resources.find(r => r.id === resourceId)?.likes ?? 0) + 1 })
        .eq('id', resourceId)
    }
  }

  /* ── filtered list ── */
  const filtered = resources.filter(r => {
    const matchType = filterType === 'all' || r.type === filterType
    const matchSearch =
      !search ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.description?.toLowerCase().includes(search.toLowerCase()) ||
      (r.course as Course)?.title?.toLowerCase().includes(search.toLowerCase())
    return matchType && matchSearch
  })

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  /* ─────────── render ─────────── */
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #0b1326 0%, #060e20 100%)' }}>
      <Topbar searchPlaceholder="Search resources..." onSearch={setSearch} />
      <div className="pt-16 p-6 max-w-[1280px] mx-auto">

        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4 pt-2">
          <div>
            <h2 className="text-4xl font-bold text-[#dae2fd] tracking-tight">Shared Resources</h2>
            <p className="text-[#c2c6d6] mt-1">
              Curated links, videos, and books shared by the squad.
            </p>
          </div>

          <div className="flex gap-3 flex-wrap">
            {/* Filter tabs */}
            <div className="flex bg-[#131b2e] border border-white/10 rounded-xl p-1 gap-1">
              {(['all', ...Object.keys(TYPE_META)] as ('all' | ResourceType)[]).map(t => {
                const meta = t === 'all' ? null : TYPE_META[t]
                const Icon = meta?.icon
                return (
                  <button
                    key={t}
                    onClick={() => setFilterType(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition-all flex items-center gap-1.5 ${
                      filterType === t
                        ? 'bg-theme-accent text-[#002e6a]'
                        : 'text-[#c2c6d6] hover:text-[#dae2fd] hover:bg-white/5'
                    }`}
                  >
                    {Icon && <Icon size={12} />}
                    {t}
                  </button>
                )
              })}
            </div>

            {/* Add Resource dialog */}
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger className="gradient-btn text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-semibold neon-glow transition-all active:scale-95">
                <Plus size={16} /> Add Resource
              </DialogTrigger>
              <DialogContent className="bg-[#171f33] border border-white/10 text-[#dae2fd] max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-theme-accent text-xl">Share a Resource</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                  <div>
                    <label className="text-xs font-mono text-[#c2c6d6] uppercase tracking-widest mb-1 block">Title *</label>
                    <Input
                      value={form.title}
                      onChange={e => setForm({ ...form, title: e.target.value })}
                      placeholder="e.g. The Odin Project – Full Stack"
                      className="bg-[#222a3d] border-white/5 text-[#dae2fd] placeholder:text-[#c2c6d6]/40"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-mono text-[#c2c6d6] uppercase tracking-widest mb-1 block">URL *</label>
                    <Input
                      value={form.url}
                      onChange={e => setForm({ ...form, url: e.target.value })}
                      placeholder="https://..."
                      className="bg-[#222a3d] border-white/5 text-[#dae2fd] placeholder:text-[#c2c6d6]/40"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-mono text-[#c2c6d6] uppercase tracking-widest mb-1 block">Description</label>
                    <Input
                      value={form.description}
                      onChange={e => setForm({ ...form, description: e.target.value })}
                      placeholder="Why is this useful?"
                      className="bg-[#222a3d] border-white/5 text-[#dae2fd] placeholder:text-[#c2c6d6]/40"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-mono text-[#c2c6d6] uppercase tracking-widest mb-1 block">Type</label>
                      <Select value={form.type} onValueChange={v => setForm({ ...form, type: (v || 'article') as ResourceType })}>
                        <SelectTrigger className="bg-[#222a3d] border-white/5 text-[#dae2fd]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#171f33] border-white/10 text-[#dae2fd]">
                          {Object.entries(TYPE_META).map(([val, meta]) => (
                            <SelectItem key={val} value={val}>{meta.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-mono text-[#c2c6d6] uppercase tracking-widest mb-1 block">Related Course</label>
                      <Select value={form.course_id ?? ''} onValueChange={v => setForm({ ...form, course_id: v ?? '' })}>
                        <SelectTrigger className="bg-[#222a3d] border-white/5 text-[#dae2fd]">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#171f33] border-white/10 text-[#dae2fd]">
                          <SelectItem value="none">None</SelectItem>
                          {courses.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setOpen(false)}
                      className="flex-1 py-2.5 rounded-xl text-[#c2c6d6] hover:bg-[#2d3449]/50 transition-all text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={saving || !form.title.trim() || !form.url.trim()}
                      className="flex-1 py-2.5 rounded-xl gradient-btn text-white font-semibold text-sm disabled:opacity-50 transition-all"
                    >
                      {saving ? 'Sharing...' : 'Share Resource'}
                    </button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* ── Stats bar ── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          {(['all', ...Object.keys(TYPE_META)] as ('all' | ResourceType)[]).map(t => {
            const count = t === 'all' ? resources.length : resources.filter(r => r.type === t).length
            const meta = t === 'all' ? null : TYPE_META[t]
            const Icon = meta?.icon
            return (
              <div
                key={t}
                onClick={() => setFilterType(t)}
                className={`glass-card p-4 rounded-xl flex items-center gap-3 cursor-pointer transition-all hover:border-theme-accent/30 ${
                  filterType === t ? 'border border-theme-accent/50 bg-theme-accent-10' : 'border border-white/5'
                }`}
              >
                {Icon
                  ? <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${meta?.bg}`}>
                      <Icon size={18} className={meta?.color} />
                    </div>
                  : <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-theme-accent-10">
                      <Filter size={18} className="text-theme-accent" />
                    </div>
                }
                <div>
                  <p className="text-[10px] font-mono text-[#c2c6d6]/60 uppercase tracking-wider">{t}</p>
                  <p className="text-xl font-bold text-[#dae2fd]">{count}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Resources grid ── */}
        {loading ? (
          <div className="text-center py-20 text-[#c2c6d6]">Loading resources...</div>
        ) : filtered.length === 0 ? (
          <div className="glass-card rounded-xl p-16 text-center">
            <Bookmark size={48} className="mx-auto text-[#c2c6d6]/20 mb-4" />
            <p className="text-[#dae2fd] font-semibold text-lg mb-1">No resources yet</p>
            <p className="text-[#c2c6d6]/60 text-sm mb-4">Be the first to share something useful with the squad!</p>
            <button
              onClick={() => setOpen(true)}
              className="gradient-btn text-white px-6 py-2.5 rounded-xl text-sm font-semibold neon-glow"
            >
              Add Resource
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map(resource => {
              const meta = TYPE_META[resource.type] || TYPE_META.other
              const TypeIcon = meta.icon
              const liked = likedIds.has(resource.id)
              const author = resource.author as Profile | undefined
              const relCourse = resource.course as Course | undefined

              return (
                <div
                  key={resource.id}
                  className="glass-card rounded-xl p-5 flex flex-col gap-4 group hover:border-theme-accent/20 transition-all border border-white/5"
                >
                  {/* Top row: type badge + open link */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-mono font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider ${meta.color} ${meta.bg}`}>
                        <TypeIcon size={12} />
                        {meta.label}
                      </span>
                      {relCourse && (
                        <Badge className="bg-[#c0c1ff]/10 text-[#c0c1ff] text-xs border-0 font-mono">
                          {relCourse.title.length > 20 ? relCourse.title.slice(0, 20) + '…' : relCourse.title}
                        </Badge>
                      )}
                    </div>
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/5 hover:bg-theme-accent-10 hover:text-theme-accent text-[#c2c6d6] flex items-center justify-center transition-all"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>

                  {/* Title & description */}
                  <div className="flex-1">
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <h3 className="font-bold text-[#dae2fd] group-hover:text-theme-accent transition-colors text-base leading-snug mb-1 line-clamp-2">
                        {resource.title}
                      </h3>
                    </a>
                    {resource.description && (
                      <p className="text-sm text-[#c2c6d6]/70 line-clamp-2 leading-relaxed">
                        {resource.description}
                      </p>
                    )}
                    <p className="text-[11px] font-mono text-[#c2c6d6]/40 mt-2">
                      🔗 {getDomain(resource.url)}
                    </p>
                  </div>

                  {/* Bottom row: author + time + likes */}
                  <div className="flex items-center justify-between pt-3 border-t border-white/5">
                    <div className="flex items-center gap-2">
                      {author ? (
                        <>
                          <Avatar className="w-7 h-7 border border-white/10">
                            <AvatarImage src={author.avatar_url || ''} alt={author.name} />
                            <AvatarFallback className="bg-theme-accent-10 text-theme-accent text-[10px] font-bold">
                              {getInitials(author.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-[#c2c6d6]/60 font-mono">
                            {author.name.split(' ')[0]}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-[#c2c6d6]/40 font-mono">Anonymous</span>
                      )}
                      <span className="text-[10px] text-[#c2c6d6]/30 font-mono">· {timeAgo(resource.created_at)}</span>
                    </div>

                    <button
                      onClick={() => handleLike(resource.id)}
                      className={`flex items-center gap-1.5 text-xs font-mono font-bold px-2.5 py-1.5 rounded-lg transition-all ${
                        liked
                          ? 'text-[#ff6b9d] bg-[#ff6b9d]/10 hover:bg-[#ff6b9d]/20'
                          : 'text-[#c2c6d6]/50 hover:text-[#ff6b9d] hover:bg-[#ff6b9d]/10'
                      }`}
                    >
                      <Heart size={13} className={liked ? 'fill-current' : ''} />
                      {resource.likes}
                    </button>
                  </div>
                </div>
              )
            })}

            {/* Add placeholder card */}
            <div
              onClick={() => setOpen(true)}
              className="border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center p-10 group hover:border-theme-accent/40 hover:bg-theme-accent-10 transition-all cursor-pointer min-h-[200px]"
            >
              <div className="w-14 h-14 rounded-full bg-[#2d3449] flex items-center justify-center text-[#c2c6d6] group-hover:text-theme-accent group-hover:scale-110 transition-all mb-3">
                <Plus size={28} />
              </div>
              <span className="text-base font-semibold text-[#c2c6d6] group-hover:text-theme-accent">Share a Resource</span>
              <p className="text-[#c2c6d6]/60 text-sm text-center mt-1">Add a helpful link for the squad</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
