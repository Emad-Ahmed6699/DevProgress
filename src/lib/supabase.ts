import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface Profile {
  id: string
  name: string
  role: string
  avatar_url: string | null
  completed_tasks_count: number
  efficiency: number
  status: string
  last_active: string
}

export interface Course {
  id: string
  title: string
  description: string | null
  category: string | null
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | null
  progress: number
  modules_count: number
  completed_modules_count: number
  thumbnail_url: string | null
  priority: string | null
  created_at: string
}

export interface Task {
  id: string
  course_id: string
  title: string
  description: string | null
  status: 'todo' | 'inprogress' | 'done'
  assignee_id: string | null
  last_updated_by: string | null
  updated_at: string
  assignee?: Profile
  last_updater?: Profile
}

export interface Activity {
  id: string
  user_id: string
  description: string
  course_id: string | null
  created_at: string
  user?: Profile
  course?: Course
}
