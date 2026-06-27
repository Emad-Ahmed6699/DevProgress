'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase, Course, Task, Profile } from '@/lib/supabase'
import { useProfile } from '@/contexts/ProfileContext'
import Topbar from '@/components/Topbar'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ChevronRight, Plus, MoreVertical, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  todo:       { label: 'To Do',       color: 'text-[#c2c6d6]', bg: 'bg-[#c2c6d6]/10' },
  inprogress: { label: 'In Progress', color: 'text-theme-accent', bg: 'bg-theme-accent-10' },
  done:       { label: 'Done',        color: 'text-[#4edea3]', bg: 'bg-[#4edea3]/10' },
}

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { activeProfile, profiles } = useProfile()
  const [course, setCourse] = useState<Course | null>(null)
  const [tasks, setTasks] = useState<(Task & { assignee?: Profile })[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<{ title: string; description: string; status: string; assignee_id: string }>({ title: '', description: '', status: 'todo', assignee_id: '' })

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [courseRes, tasksRes] = await Promise.all([
      supabase.from('courses').select('*').eq('id', id).single(),
      supabase.from('tasks').select('*, assignee:assignee_id(*)').eq('course_id', id).order('updated_at', { ascending: false }),
    ])
    setCourse(courseRes.data)
    setTasks(tasksRes.data || [])
    setLoading(false)
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  // Update course progress when tasks change
  const updateCourseProgress = useCallback(async (updatedTasks: Task[]) => {
    if (!course) return
    const done = updatedTasks.filter((t) => t.status === 'done').length
    const total = updatedTasks.length
    const progress = total > 0 ? Math.round((done / total) * 100) : 0
    const completedModules = Math.round((done / Math.max(total, 1)) * course.modules_count)
    await supabase.from('courses').update({ progress, completed_modules_count: completedModules }).eq('id', id)
    setCourse((prev) => prev ? { ...prev, progress, completed_modules_count: completedModules } : prev)
  }, [course, id])

  const handleStatusChange = async (taskId: string, newStatus: string | null) => {
    if (!newStatus) return
    await supabase.from('tasks').update({
      status: newStatus,
      last_updated_by: activeProfile?.id || null,
      updated_at: new Date().toISOString(),
    }).eq('id', taskId)

    const updatedTasks = tasks.map((t) => t.id === taskId ? { ...t, status: newStatus as Task['status'] } : t)
    setTasks(updatedTasks)
    updateCourseProgress(updatedTasks)

    // Log activity
    if (activeProfile) {
      const task = tasks.find((t) => t.id === taskId)
      await supabase.from('activities').insert({
        user_id: activeProfile.id,
        description: `marked "${task?.title}" as ${STATUS_STYLES[newStatus]?.label}`,
        course_id: id,
      })
    }
  }

  const handleAddTask = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    const { error } = await supabase.from('tasks').insert({
      course_id: id,
      title: form.title.trim(),
      description: form.description || null,
      status: form.status,
      assignee_id: form.assignee_id || null,
      last_updated_by: activeProfile?.id || null,
    })
    if (!error) {
      if (activeProfile) {
        await supabase.from('activities').insert({
          user_id: activeProfile.id,
          description: `added task "${form.title.trim()}" to this course`,
          course_id: id,
        })
      }
      setForm({ title: '', description: '', status: 'todo', assignee_id: '' })
      setOpen(false)
      fetchData()
    }
    setSaving(false)
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Delete this task?')) return
    await supabase.from('tasks').delete().eq('id', taskId)
    const updatedTasks = tasks.filter((t) => t.id !== taskId)
    setTasks(updatedTasks)
    updateCourseProgress(updatedTasks)
  }

  const doneTasks = tasks.filter((t) => t.status === 'done').length
  const progress = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : course?.progress || 0

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0b1326' }}>
        <p className="text-[#c2c6d6]">Loading course...</p>
      </div>
    )
  }

  if (!course) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: '#0b1326' }}>
        <p className="text-[#c2c6d6]">Course not found.</p>
        <Link href="/courses" className="text-[#adc6ff] hover:underline">← Back to Courses</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #0b1326 0%, #060e20 100%)' }}>
      <Topbar searchPlaceholder="Search tasks..." />
      <div className="pt-16 p-6 max-w-[1280px] mx-auto">

        {/* Course Header */}
        <div className="glass-card p-8 rounded-xl mb-6 relative overflow-hidden mt-2">
          <div className="relative z-10">
            <nav className="flex items-center gap-2 text-xs font-mono text-[#c2c6d6] mb-3">
              <Link href="/courses" className="hover:text-theme-accent flex items-center gap-1">
                <ArrowLeft size={12} /> Courses
              </Link>
              <ChevronRight size={12} />
              <span className="text-theme-accent">{course.title}</span>
            </nav>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <h2 className="text-4xl font-bold text-[#dae2fd] tracking-tight">{course.title}</h2>
                {course.description && (
                  <p className="text-[#c2c6d6] mt-2 max-w-xl">{course.description}</p>
                )}
                <div className="flex items-center gap-6 mt-3 text-sm text-[#c2c6d6]">
                  {course.category && <span className="flex items-center gap-1"><span className="text-theme-accent">Category:</span> {course.category}</span>}
                  <span className="flex items-center gap-1"><span className="text-theme-accent">Modules:</span> {course.modules_count}</span>
                  {course.difficulty && <span className="flex items-center gap-1"><span className="text-theme-accent">Difficulty:</span> {course.difficulty}</span>}
                </div>
              </div>
              {/* Progress circle */}
              <div className="md:w-72">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold text-[#c2c6d6]">Course Progress</span>
                  <span className="text-sm font-bold text-theme-accent">{progress}%</span>
                </div>
                <div className="w-full h-3 bg-[#2d3449]/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-theme-accent rounded-full transition-all duration-700"
                    style={{ width: `${progress}%`, filter: 'drop-shadow(0 0 4px var(--accent-color))' }}
                  />
                </div>
                <p className="text-xs font-mono text-[#c2c6d6]/60 mt-1">{doneTasks} of {tasks.length} tasks done</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tasks Section */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-semibold text-[#dae2fd]">Curriculum Tasks</h3>
            <span className="px-2 py-0.5 rounded bg-[#2d3449] text-[#c2c6d6] text-xs font-mono">{tasks.length} Tasks</span>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger className="gradient-btn text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-semibold neon-glow transition-all active:scale-95">
              <Plus size={16} /> Add Task
            </DialogTrigger>
            <DialogContent className="bg-[#171f33] border border-white/10 text-[#dae2fd] max-w-md">
              <DialogHeader>
                <DialogTitle className="text-theme-accent text-xl">New Task</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <label className="text-xs font-mono text-[#c2c6d6] uppercase tracking-widest mb-1 block">Task Title *</label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. Setup Environment"
                    className="bg-[#222a3d] border-white/5 text-[#dae2fd] placeholder:text-[#c2c6d6]/40"
                  />
                </div>
                <div>
                  <label className="text-xs font-mono text-[#c2c6d6] uppercase tracking-widest mb-1 block">Description</label>
                  <Input
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="What does this task involve?"
                    className="bg-[#222a3d] border-white/5 text-[#dae2fd] placeholder:text-[#c2c6d6]/40"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-mono text-[#c2c6d6] uppercase tracking-widest mb-1 block">Status</label>
                    <Select value={form.status || 'todo'} onValueChange={(v) => setForm({ ...form, status: v || 'todo' })}>
                      <SelectTrigger className="bg-[#222a3d] border-white/5 text-[#dae2fd]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#171f33] border-white/10 text-[#dae2fd]">
                        <SelectItem value="todo">To Do</SelectItem>
                        <SelectItem value="inprogress">In Progress</SelectItem>
                        <SelectItem value="done">Done</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-mono text-[#c2c6d6] uppercase tracking-widest mb-1 block">Assignee</label>
                    <Select value={form.assignee_id} onValueChange={(v) => setForm({ ...form, assignee_id: v || '' })}>
                      <SelectTrigger className="bg-[#222a3d] border-white/5 text-[#dae2fd]">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent className="bg-[#171f33] border-white/10 text-[#dae2fd]">
                        {profiles.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setOpen(false)} className="flex-1 py-2.5 rounded-xl text-[#c2c6d6] hover:bg-[#2d3449]/50 transition-all text-sm">
                    Cancel
                  </button>
                  <button
                    onClick={handleAddTask}
                    disabled={saving || !form.title.trim()}
                    className="flex-1 py-2.5 rounded-xl gradient-btn text-white font-semibold text-sm disabled:opacity-50 transition-all"
                  >
                    {saving ? 'Adding...' : 'Add Task'}
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Tasks Table */}
        {tasks.length === 0 ? (
          <div className="glass-card rounded-xl p-12 text-center">
            <p className="text-[#c2c6d6] mb-2">No tasks yet for this course.</p>
            <button onClick={() => setOpen(true)} className="text-theme-accent text-sm hover:underline">
              Add the first task →
            </button>
          </div>
        ) : (
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#222a3d]/50 border-b border-white/5">
                    <th className="px-6 py-4 text-xs font-mono text-[#c2c6d6] uppercase tracking-wider">Task</th>
                    <th className="px-6 py-4 text-xs font-mono text-[#c2c6d6] uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-mono text-[#c2c6d6] uppercase tracking-wider">Assignee</th>
                    <th className="px-6 py-4 text-xs font-mono text-[#c2c6d6] uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {tasks.map((task) => {
                    const style = STATUS_STYLES[task.status]
                    const assignee = task.assignee as Profile | undefined
                    return (
                      <tr key={task.id} className="hover:bg-white/5 transition-colors group">
                        <td className="px-6 py-5">
                          <p className={`font-semibold text-[#dae2fd] group-hover:text-theme-accent transition-colors ${task.status === 'done' ? 'line-through text-[#c2c6d6]/60' : ''}`}>
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-sm text-[#c2c6d6]/60 mt-0.5 line-clamp-1">{task.description}</p>
                          )}
                        </td>
                        <td className="px-6 py-5">
                          <Select value={task.status} onValueChange={(v) => handleStatusChange(task.id, v)}>
                            <SelectTrigger className={`w-36 border-0 text-xs font-mono font-bold ${style.color} ${style.bg} focus:ring-0 rounded-lg`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#171f33] border-white/10 text-[#dae2fd]">
                              {Object.entries(STATUS_STYLES).map(([val, s]) => (
                                <SelectItem key={val} value={val} className={s.color}>{s.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-6 py-5">
                          {assignee ? (
                            <div className="flex items-center gap-2">
                              <Avatar className="w-8 h-8 border border-white/10">
                                <AvatarImage src={assignee.avatar_url || ''} alt={assignee.name} />
                                <AvatarFallback className="bg-theme-accent-10 text-theme-accent text-xs">
                                  {getInitials(assignee.name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm text-[#dae2fd]">{assignee.name.split(' ')[0]}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-[#c2c6d6]/40 italic">Unassigned</span>
                          )}
                        </td>
                        <td className="px-6 py-5">
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="text-[#c2c6d6]/40 hover:text-[#ffb4ab] transition-colors"
                            title="Delete task"
                          >
                            <MoreVertical size={18} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
