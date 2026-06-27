'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase, Course, Activity, Profile } from '@/lib/supabase'
import { useProfile } from '@/contexts/ProfileContext'
import Topbar from '@/components/Topbar'
import { Badge } from '@/components/ui/badge'
import { BookOpen, CheckCircle, TrendingUp, Clock, ArrowRight } from 'lucide-react'

const PRIORITY_COLORS: Record<string, string> = {
  'High Priority': 'bg-[#adc6ff]/10 text-[#adc6ff]',
  'Intermediate': 'bg-[#4edea3]/10 text-[#4edea3]',
  'Core Path': 'bg-[#c0c1ff]/10 text-[#c0c1ff]',
  'Normal': 'bg-white/10 text-[#c2c6d6]',
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) {
  return (
    <div className="glass-card p-6 rounded-xl flex items-center justify-between">
      <div>
        <p className="text-xs font-mono text-[#c2c6d6] uppercase tracking-wider mb-1">{label}</p>
        <h3 className="text-4xl font-bold text-[#dae2fd]">{value}</h3>
      </div>
      <div className={`w-12 h-12 rounded-lg ${color} flex items-center justify-center`}>
        <Icon size={24} />
      </div>
    </div>
  )
}

function ProgressBar({ value, color = 'from-[#adc6ff] to-[#c0c1ff]' }: { value: number; color?: string }) {
  return (
    <div className="w-full h-2 bg-[#2d3449]/50 rounded-full overflow-hidden">
      <div
        className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-700`}
        style={{ width: `${Math.min(value, 100)}%`, filter: 'drop-shadow(0 0 4px rgba(77,142,255,0.5))' }}
      />
    </div>
  )
}

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`
  return `${Math.floor(seconds / 86400)} days ago`
}

function getActivityColor(desc: string): string {
  if (desc.toLowerCase().includes('complet') || desc.toLowerCase().includes('done')) return 'bg-[#4edea3]'
  if (desc.toLowerCase().includes('add') || desc.toLowerCase().includes('creat')) return 'bg-[#adc6ff]'
  if (desc.toLowerCase().includes('start') || desc.toLowerCase().includes('progress')) return 'bg-[#c0c1ff]'
  return 'bg-[#adc6ff]/60'
}

export default function DashboardPage() {
  const { activeProfile } = useProfile()
  const [courses, setCourses] = useState<Course[]>([])
  const [activities, setActivities] = useState<(Activity & { user?: Profile })[]>([])
  const [stats, setStats] = useState({ totalCourses: 0, completedTasks: 0, overallProgress: 0 })
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [coursesRes, activitiesRes, tasksRes] = await Promise.all([
      supabase.from('courses').select('*').order('created_at', { ascending: false }),
      supabase.from('activities').select('*, user:user_id(*)').order('created_at', { ascending: false }).limit(6),
      supabase.from('tasks').select('status'),
    ])

    const coursesData = coursesRes.data || []
    const activitiesData = activitiesRes.data || []
    const tasksData = tasksRes.data || []

    const completedTasks = tasksData.filter((t) => t.status === 'done').length
    const avgProgress = coursesData.length
      ? Math.round(coursesData.reduce((sum, c) => sum + (c.progress || 0), 0) / coursesData.length)
      : 0

    setCourses(coursesData.slice(0, 3))
    setActivities(activitiesData)
    setStats({ totalCourses: coursesData.length, completedTasks, overallProgress: avgProgress })
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const getFirstName = (name: string) => name.split(' ')[0]

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #0b1326 0%, #060e20 100%)' }}>
      <Topbar searchPlaceholder="Search courses, tasks..." />
      <div className="pt-16 p-6 max-w-[1280px] mx-auto space-y-6">

        {/* Welcome */}
        <div className="flex justify-between items-end pt-2">
          <div>
            <h2 className="text-3xl font-bold text-theme-accent tracking-tight">
              Welcome back, {activeProfile ? getFirstName(activeProfile.name) : '...'}
            </h2>
            <p className="text-[#c2c6d6] mt-1">Track your technical progression and team momentum.</p>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-xs font-mono text-[#c2c6d6] uppercase tracking-widest">Team Status</p>
            <p className="text-lg font-semibold text-[#4edea3]">● Active</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard label="Total Courses" value={stats.totalCourses} icon={BookOpen} color="bg-theme-accent-10 text-theme-accent" />
          <StatCard label="Tasks Completed" value={stats.completedTasks} icon={CheckCircle} color="bg-[#4edea3]/10 text-[#4edea3]" />
          <div className="glass-card p-6 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-mono text-[#c2c6d6] uppercase tracking-wider mb-1">Overall Progress</p>
              <h3 className="text-4xl font-bold text-[#dae2fd]">{stats.overallProgress}%</h3>
            </div>
            <div className="relative w-20 h-20">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="32" fill="transparent" stroke="rgba(45,52,73,0.5)" strokeWidth="6" />
                <circle
                  cx="40" cy="40" r="32" fill="transparent"
                  stroke="var(--accent-color)"
                  strokeWidth="6"
                  strokeDasharray={`${2 * Math.PI * 32}`}
                  strokeDashoffset={`${2 * Math.PI * 32 * (1 - stats.overallProgress / 100)}`}
                  style={{ filter: 'drop-shadow(0 0 4px var(--accent-color))', transition: 'stroke-dashoffset 0.7s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-bold text-theme-accent">{stats.overallProgress}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Active Courses + Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Courses */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xl font-semibold text-[#dae2fd]">Active Courses</h4>
              <Link href="/courses" className="flex items-center gap-1 text-theme-accent text-sm hover:underline">
                View All <ArrowRight size={14} />
              </Link>
            </div>

            {loading ? (
              <div className="glass-card rounded-xl p-6 text-center text-[#c2c6d6]">Loading courses...</div>
            ) : courses.length === 0 ? (
              <div className="glass-card rounded-xl p-8 text-center">
                <BookOpen size={40} className="mx-auto text-[#c2c6d6]/30 mb-3" />
                <p className="text-[#c2c6d6]">No active courses yet.</p>
                <Link href="/courses" className="mt-3 inline-block text-theme-accent text-sm hover:underline">
                  Add your first course →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {courses.map((course) => (
                  <Link key={course.id} href={`/courses/${course.id}`}>
                    <div className="glass-card p-4 rounded-xl group cursor-pointer">
                      <div className="flex items-start gap-4">
                        <div className="w-20 h-14 rounded-lg overflow-hidden flex-shrink-0 border border-white/5 bg-[#2d3449] flex items-center justify-center">
                          {course.thumbnail_url ? (
                            <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
                          ) : (
                            <BookOpen size={24} className="text-theme-accent/40" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-2">
                            <h5 className="font-semibold text-[#dae2fd] group-hover:text-theme-accent transition-colors truncate pr-2">
                              {course.title}
                            </h5>
                            {course.priority && (
                              <Badge className={`text-xs flex-shrink-0 ${PRIORITY_COLORS[course.priority] || 'bg-white/10 text-[#c2c6d6]'}`}>
                                {course.priority}
                              </Badge>
                            )}
                          </div>
                          <ProgressBar value={course.progress || 0} />
                          <div className="flex justify-between mt-1 text-xs text-[#c2c6d6]/70 font-mono">
                            <span>{course.progress || 0}% Complete</span>
                            <span>{course.completed_modules_count}/{course.modules_count} Modules</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Activity Feed */}
          <div className="space-y-4">
            <h4 className="text-xl font-semibold text-[#dae2fd]">Recent Activity</h4>
            <div className="glass-card p-6 rounded-xl h-full">
              {loading ? (
                <p className="text-[#c2c6d6] text-sm text-center">Loading activity...</p>
              ) : activities.length === 0 ? (
                <div className="text-center py-8">
                  <TrendingUp size={32} className="mx-auto text-[#c2c6d6]/30 mb-2" />
                  <p className="text-[#c2c6d6] text-sm">No activity yet</p>
                </div>
              ) : (
                <div className="space-y-5 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-white/5">
                  {activities.map((activity) => (
                    <div key={activity.id} className="relative pl-8">
                      <div className={`absolute left-0 top-0.5 w-6 h-6 rounded-full ${getActivityColor(activity.description)} flex items-center justify-center ring-4 ring-[#0b1326]`}>
                        <span className="text-[10px] font-bold text-[#002e6a]">
                          {(activity.user as Profile)?.name?.[0] || '?'}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm text-[#dae2fd]">
                          <span className="font-bold text-theme-accent">
                            {(activity.user as Profile)?.name?.split(' ')[0] || 'Someone'}
                          </span>{' '}
                          {activity.description}
                        </p>
                        <p className="text-xs text-[#c2c6d6]/50 mt-0.5 flex items-center gap-1">
                          <Clock size={10} />
                          {timeAgo(activity.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
