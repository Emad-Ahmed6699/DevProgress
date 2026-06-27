'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase, Course } from '@/lib/supabase'
import Topbar from '@/components/Topbar'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BookOpen, Plus, Edit, Trash2 } from 'lucide-react'

const DIFFICULTY_COLORS: Record<string, string> = {
  EASY: 'text-[#4edea3]',
  MEDIUM: 'text-[#adc6ff]',
  HARD: 'text-[#c0c1ff]',
}

const DIFFICULTY_BG: Record<string, string> = {
  EASY: 'bg-[#4edea3]/10',
  MEDIUM: 'bg-[#adc6ff]/10',
  HARD: 'bg-[#c0c1ff]/10',
}

function ProgressBar({ value }: { value: number }) {
  const color = value >= 100 ? 'from-[#4edea3] to-[#00a572]' : 'from-[#adc6ff] to-[#4edea3]'
  return (
    <div className="w-full h-2 bg-[#2d3449]/50 rounded-full overflow-hidden">
      <div
        className={`h-full bg-gradient-to-r ${color} rounded-full`}
        style={{ width: `${Math.min(value, 100)}%`, filter: 'drop-shadow(0 0 3px rgba(77,142,255,0.5))' }}
      />
    </div>
  )
}

interface CourseFormData {
  title: string
  description: string
  category: string
  difficulty: 'EASY' | 'MEDIUM' | 'HARD'
  modules_count: string
  priority: string
}

const DEFAULT_FORM: CourseFormData = {
  title: '',
  description: '',
  category: '',
  difficulty: 'MEDIUM',
  modules_count: '10',
  priority: 'Normal',
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [filtered, setFiltered] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<CourseFormData>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [filterDiff, setFilterDiff] = useState('all')
  const [search, setSearch] = useState('')

  const fetchCourses = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('courses').select('*').order('created_at', { ascending: false })
    const result = data || []
    setCourses(result)
    setFiltered(result)
    setLoading(false)
  }, [])

  useEffect(() => { fetchCourses() }, [fetchCourses])

  useEffect(() => {
    let result = courses
    if (filterDiff !== 'all') result = result.filter((c) => c.difficulty === filterDiff)
    if (search) result = result.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()))
    setFiltered(result)
  }, [filterDiff, search, courses])

  const handleSubmit = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    const { error } = await supabase.from('courses').insert({
      title: form.title.trim(),
      description: form.description || null,
      category: form.category || null,
      difficulty: form.difficulty,
      modules_count: parseInt(form.modules_count) || 0,
      completed_modules_count: 0,
      progress: 0,
      priority: form.priority,
    })
    if (!error) {
      setForm(DEFAULT_FORM)
      setOpen(false)
      fetchCourses()
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this course and all its tasks?')) return
    await supabase.from('courses').delete().eq('id', id)
    fetchCourses()
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #0b1326 0%, #060e20 100%)' }}>
      <Topbar searchPlaceholder="Search courses..." onSearch={setSearch} />
      <div className="pt-16 p-6 max-w-[1280px] mx-auto">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4 pt-2">
          <div>
            <h2 className="text-4xl font-bold text-[#dae2fd] tracking-tight">Course Management</h2>
            <p className="text-[#c2c6d6] mt-1">Architect your learning path and track technical mastery.</p>
          </div>
          <div className="flex gap-3">
            <Select value={filterDiff} onValueChange={(v) => v && setFilterDiff(v)}>
              <SelectTrigger className="w-36 bg-[#222a3d]/50 border-white/5 text-[#dae2fd] text-sm">
                <SelectValue placeholder="Difficulty" />
              </SelectTrigger>
              <SelectContent className="bg-[#171f33] border-white/10 text-[#dae2fd]">
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="EASY">Easy</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HARD">Hard</SelectItem>
              </SelectContent>
            </Select>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger className="gradient-btn text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-semibold neon-glow transition-all active:scale-95">
                <Plus size={16} /> Add Course
              </DialogTrigger>
              <DialogContent className="bg-[#171f33] border border-white/10 text-[#dae2fd] max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-theme-accent text-xl">New Course</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                  <div>
                    <label className="text-xs font-mono text-[#c2c6d6] uppercase tracking-widest mb-1 block">Title *</label>
                    <Input
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder="e.g. React Masterclass"
                      className="bg-[#222a3d] border-white/5 text-[#dae2fd] placeholder:text-[#c2c6d6]/40"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-mono text-[#c2c6d6] uppercase tracking-widest mb-1 block">Description</label>
                    <Input
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Brief description..."
                      className="bg-[#222a3d] border-white/5 text-[#dae2fd] placeholder:text-[#c2c6d6]/40"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-mono text-[#c2c6d6] uppercase tracking-widest mb-1 block">Category</label>
                      <Input
                        value={form.category}
                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                        placeholder="e.g. Frontend"
                        className="bg-[#222a3d] border-white/5 text-[#dae2fd] placeholder:text-[#c2c6d6]/40"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-mono text-[#c2c6d6] uppercase tracking-widest mb-1 block">Modules</label>
                      <Input
                        type="number"
                        value={form.modules_count}
                        onChange={(e) => setForm({ ...form, modules_count: e.target.value })}
                        className="bg-[#222a3d] border-white/5 text-[#dae2fd]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-mono text-[#c2c6d6] uppercase tracking-widest mb-1 block">Difficulty</label>
                      <Select value={form.difficulty} onValueChange={(v) => setForm({ ...form, difficulty: (v || 'MEDIUM') as 'EASY' | 'MEDIUM' | 'HARD' })}>
                        <SelectTrigger className="bg-[#222a3d] border-white/5 text-[#dae2fd]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#171f33] border-white/10 text-[#dae2fd]">
                          <SelectItem value="EASY">Easy</SelectItem>
                          <SelectItem value="MEDIUM">Medium</SelectItem>
                          <SelectItem value="HARD">Hard</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-mono text-[#c2c6d6] uppercase tracking-widest mb-1 block">Priority</label>
                      <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v || 'Normal' })}>
                        <SelectTrigger className="bg-[#222a3d] border-white/5 text-[#dae2fd]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#171f33] border-white/10 text-[#dae2fd]">
                          <SelectItem value="High Priority">High Priority</SelectItem>
                          <SelectItem value="Intermediate">Intermediate</SelectItem>
                          <SelectItem value="Core Path">Core Path</SelectItem>
                          <SelectItem value="Normal">Normal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setOpen(false)} className="flex-1 py-2.5 rounded-xl text-[#c2c6d6] hover:bg-[#2d3449]/50 transition-all text-sm">
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={saving || !form.title.trim()}
                      className="flex-1 py-2.5 rounded-xl gradient-btn text-white font-semibold text-sm disabled:opacity-50 transition-all"
                    >
                      {saving ? 'Creating...' : 'Create Course'}
                    </button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="text-center py-20 text-[#c2c6d6]">Loading courses...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((course) => (
              <div key={course.id} className="glass-card rounded-xl overflow-hidden flex flex-col group">
                {/* Card image */}
                <div className="relative h-40 overflow-hidden bg-[#131b2e]">
                  {course.thumbnail_url ? (
                    <img
                      src={course.thumbnail_url}
                      alt={course.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BookOpen size={40} className="text-theme-accent/20" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#131b2e] to-transparent opacity-60" />
                  {course.difficulty && (
                    <div className="absolute top-3 right-3">
                      <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${DIFFICULTY_COLORS[course.difficulty]} ${DIFFICULTY_BG[course.difficulty]} bg-opacity-80 backdrop-blur-sm uppercase tracking-wider`}>
                        {course.difficulty}
                      </span>
                    </div>
                  )}
                  {/* Hover actions */}
                  <div className="absolute inset-0 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity bg-[#0b1326]/50 backdrop-blur-[2px]">
                    <Link href={`/courses/${course.id}`}>
                      <button className="bg-theme-accent text-[#002e6a] p-2 rounded-lg hover:scale-110 transition-transform">
                        <Edit size={16} />
                      </button>
                    </Link>
                    <button
                      onClick={() => handleDelete(course.id)}
                      className="bg-[#93000a] text-[#ffdad6] p-2 rounded-lg hover:scale-110 transition-transform"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Card body */}
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-semibold text-lg text-[#dae2fd] group-hover:text-theme-accent transition-colors line-clamp-1">
                      {course.title}
                    </h3>
                  </div>
                  {course.category && (
                    <Badge className="self-start mb-2 bg-[#c0c1ff]/10 text-[#c0c1ff] text-xs border-0">{course.category}</Badge>
                  )}
                  <p className="text-[#c2c6d6] text-sm line-clamp-2 mb-4 flex-1">
                    {course.description || 'No description provided.'}
                  </p>
                  <div className="mt-auto">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs font-mono text-[#c2c6d6]">Progress</span>
                      <span className="text-xs font-mono text-theme-accent font-bold">{course.progress || 0}%</span>
                    </div>
                    <ProgressBar value={course.progress || 0} />
                    <Link href={`/courses/${course.id}`}>
                      <button className={`w-full mt-4 py-2.5 rounded-lg text-sm font-semibold border transition-all active:scale-[0.98] ${
                        course.progress >= 100
                          ? 'border-[#4edea3]/30 text-[#4edea3] hover:bg-[#4edea3]/10'
                          : 'border-theme-accent/20 text-theme-accent hover:bg-theme-accent-10'
                      }`}>
                        {course.progress >= 100 ? 'Completed ✓' : 'View Details'}
                      </button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}

            {/* Add placeholder */}
            <div
              onClick={() => setOpen(true)}
              className="border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center p-8 group hover:border-theme-accent/40 hover:bg-theme-accent-10 transition-all cursor-pointer min-h-[280px]"
            >
              <div className="w-14 h-14 rounded-full bg-[#2d3449] flex items-center justify-center text-[#c2c6d6] group-hover:text-theme-accent group-hover:scale-110 transition-all mb-3">
                <Plus size={28} />
              </div>
              <span className="text-lg font-semibold text-[#c2c6d6] group-hover:text-theme-accent">Create Course</span>
              <p className="text-[#c2c6d6]/60 text-sm text-center mt-1">Add a new curriculum for your team</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
