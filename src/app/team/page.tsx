'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase, Profile, Task, Activity } from '@/lib/supabase'
import Topbar from '@/components/Topbar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  Active:  { label: 'Active',   color: 'text-[#4edea3]', bg: 'bg-[#4edea3]/10' },
  Busy:    { label: 'Busy',     color: 'text-[#adc6ff]', bg: 'bg-[#adc6ff]/10' },
  Away:    { label: 'Away',     color: 'text-[#c2c6d6]', bg: 'bg-[#c2c6d6]/10' },
  Offline: { label: 'Offline',  color: 'text-[#ffb4ab]', bg: 'bg-[#ffb4ab]/10' },
}

interface HeatmapProps {
  memberTasks: Task[]
  memberActivities: Activity[]
}

function HeatmapRow({ memberTasks, memberActivities }: HeatmapProps) {
  const DAYS = 20
  const dailyCounts = new Array(DAYS).fill(0)
  const now = new Date()

  // Calculate actual daily activities for this member
  memberActivities.forEach((act) => {
    if (act.created_at) {
      const actDate = new Date(act.created_at)
      const diffDays = Math.floor((now.getTime() - actDate.getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays >= 0 && diffDays < DAYS) {
        dailyCounts[DAYS - 1 - diffDays] += 1
      }
    }
  })

  // Also include completed / updated tasks for this member
  memberTasks.forEach((task) => {
    if (task.updated_at) {
      const taskDate = new Date(task.updated_at)
      const diffDays = Math.floor((now.getTime() - taskDate.getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays >= 0 && diffDays < DAYS) {
        dailyCounts[DAYS - 1 - diffDays] += 1
      }
    }
  })

  // If member has done tasks but no specific timestamp diff, reflect done tasks
  const doneTasksCount = memberTasks.filter((t) => t.status === 'done').length
  const totalRecorded = dailyCounts.reduce((a, b) => a + b, 0)
  if (totalRecorded === 0 && doneTasksCount > 0) {
    for (let i = 0; i < Math.min(doneTasksCount, DAYS); i++) {
      dailyCounts[DAYS - 1 - i] = 1
    }
  }

  return (
    <div className="flex flex-wrap gap-[4px] bg-[#060e20]/40 p-2 rounded-lg border border-white/5">
      {dailyCounts.map((count, i) => {
        let bg = 'rgba(255, 255, 255, 0.05)' // inactive / zero activity
        if (count === 1) bg = 'rgba(78, 222, 163, 0.35)'
        else if (count === 2) bg = 'rgba(78, 222, 163, 0.65)'
        else if (count >= 3) bg = 'rgba(78, 222, 163, 1.0)'

        const dayNum = DAYS - 1 - i
        const dayLabel = dayNum === 0 ? 'Today' : `${dayNum} days ago`

        return (
          <div
            key={i}
            className="heatmap-cell"
            style={{ backgroundColor: bg }}
            title={count > 0 ? `${count} ${count === 1 ? 'task/activity' : 'tasks/activities'} (${dayLabel})` : `No activity (${dayLabel})`}
          />
        )
      })}
    </div>
  )
}

function getRecentTaskLabel(tasks: Task[]): string {
  const done = tasks.filter((t) => t.status === 'done').length
  const total = tasks.length
  if (total === 0) return 'No tasks assigned'
  const pct = Math.round((done / total) * 100)
  if (pct === 100) return 'All tasks done!'
  if (pct >= 70) return 'Excellent progress'
  if (pct >= 40) return 'On Track'
  return 'Getting started'
}

function getProgressColor(pct: number): string {
  if (pct >= 80) return 'bg-[#4edea3]/10 text-[#4edea3]'
  if (pct >= 40) return 'bg-[#adc6ff]/10 text-[#adc6ff]'
  return 'bg-[#c0c1ff]/10 text-[#c0c1ff]'
}

interface MemberWithTasks extends Profile {
  tasks: Task[]
  activities: Activity[]
  taskProgress: number
}

export default function TeamPage() {
  const [members, setMembers] = useState<MemberWithTasks[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    const [profilesRes, tasksRes, activitiesRes] = await Promise.all([
      supabase.from('profiles').select('*').order('name'),
      supabase.from('tasks').select('*, assignee:assignee_id(*)'),
      supabase.from('activities').select('*'),
    ])
    const profiles = profilesRes.data || []
    const tasks = tasksRes.data || []
    const activities = activitiesRes.data || []

    const membersWithTasks: MemberWithTasks[] = profiles.map((p: Profile) => {
      const memberTasks = tasks.filter((t: Task) => t.assignee_id === p.id)
      const memberActivities = activities.filter((a: Activity) => a.user_id === p.id)
      const done = memberTasks.filter((t: Task) => t.status === 'done').length
      const taskProgress = memberTasks.length > 0 ? Math.round((done / memberTasks.length) * 100) : 0
      return { ...p, tasks: memberTasks, activities: memberActivities, taskProgress }
    })

    setMembers(membersWithTasks)
    setLoading(false)
  }, [])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)



  const filtered = members.filter((m) =>
    !search || m.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #0b1326 0%, #060e20 100%)' }}>
      <Topbar searchPlaceholder="Search team members..." onSearch={setSearch} />
      <div className="pt-16 p-6 max-w-[1280px] mx-auto">

        {/* Header */}
        <div className="mb-8 pt-2">
          <h2 className="text-4xl font-bold text-[#dae2fd] tracking-tight">Team Members</h2>
          <p className="text-[#c2c6d6] mt-1">Track performance and engineering momentum across the squad.</p>
        </div>

        {loading ? (
          <div className="text-center py-20 text-[#c2c6d6]">Loading team...</div>
        ) : (
          <>
            {/* Member Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {filtered.map((member) => {
                const statusStyle = STATUS_BADGE[member.status] || STATUS_BADGE.Active
                return (
                  <div key={member.id} className="glass-card p-6 rounded-xl flex flex-col gap-4 group">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar className="w-16 h-16 rounded-xl border border-white/10">
                            <AvatarImage src={member.avatar_url || ''} alt={member.name} />
                            <AvatarFallback className="bg-[#4d8eff]/20 text-[#adc6ff] text-lg font-bold rounded-xl">
                              {getInitials(member.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#0b1326] ${member.status === 'Active' ? 'bg-[#4edea3]' : 'bg-[#c2c6d6]'}`} />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-[#dae2fd]">{member.name}</h3>
                          <p className="text-sm text-[#c2c6d6]/70">{member.role}</p>
                        </div>
                      </div>
                      <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded uppercase ${statusStyle.color} ${statusStyle.bg}`}>
                        {statusStyle.label}
                      </span>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-[#060e20]/40 p-3 rounded-lg border border-white/5">
                        <p className="text-[10px] font-mono text-[#c2c6d6] uppercase tracking-widest mb-1">Assigned</p>
                        <p className="text-2xl font-bold text-[#adc6ff]">{member.tasks.length}</p>
                      </div>
                      <div className="bg-[#060e20]/40 p-3 rounded-lg border border-white/5">
                        <p className="text-[10px] font-mono text-[#c2c6d6] uppercase tracking-widest mb-1">Done</p>
                        <p className="text-2xl font-bold text-[#4edea3]">
                          {member.tasks.filter((t) => t.status === 'done').length}
                        </p>
                      </div>
                    </div>

                    {/* Heatmap */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-xs font-mono text-[#c2c6d6]">Activity Heatmap</p>
                        <p className={`text-xs font-mono font-bold ${member.taskProgress >= 70 ? 'text-[#4edea3]' : 'text-[#adc6ff]'}`}>
                          {getRecentTaskLabel(member.tasks)}
                        </p>
                      </div>
                      <HeatmapRow memberTasks={member.tasks} memberActivities={member.activities} />
                    </div>
                  </div>
                )
              })}


            </div>

            {/* Progress Table */}
            <section>
              <h3 className="text-xl font-semibold text-[#dae2fd] mb-4">Task Progress Overview</h3>
              <div className="glass-card rounded-xl overflow-x-auto border border-white/10 shadow-lg">
                <table className="w-full min-w-[620px] text-left border-collapse">
                  <thead className="bg-[#222a3d]/50">
                    <tr>
                      {['Member', 'Task Progress', 'Status', 'Last Active'].map((h) => (
                        <th key={h} className="px-5 py-3.5 text-xs font-mono text-[#c2c6d6] uppercase tracking-widest border-b border-white/10 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filtered.map((member) => {
                      const label = getRecentTaskLabel(member.tasks)
                      const colorClass = getProgressColor(member.taskProgress)
                      return (
                        <tr key={member.id} className="hover:bg-white/5 transition-colors cursor-pointer">
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <Avatar className="w-9 h-9">
                                <AvatarImage src={member.avatar_url || ''} alt={member.name} />
                                <AvatarFallback className="bg-[#adc6ff]/10 text-[#adc6ff] text-xs font-bold">
                                  {getInitials(member.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-semibold text-[#dae2fd]">{member.name}</p>
                                <p className="text-xs text-[#c2c6d6]/60">{member.role}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="w-32 sm:w-36 h-1.5 bg-[#2d3449]/50 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-[#adc6ff] to-[#3131c0] rounded-full"
                                  style={{ width: `${member.taskProgress}%`, filter: 'drop-shadow(0 0 4px rgba(173,198,255,0.4))' }}
                                />
                              </div>
                              <span className="text-xs font-mono text-[#c2c6d6]">{member.taskProgress}%</span>
                            </div>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded text-xs font-mono font-bold uppercase ${colorClass}`}>
                              {label}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-sm text-[#c2c6d6]/60 font-mono whitespace-nowrap">
                            {member.last_active ? new Date(member.last_active).toLocaleDateString() : 'Recently'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
