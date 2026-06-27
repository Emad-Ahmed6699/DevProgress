import type { Metadata } from 'next'
import './globals.css'
import { ProfileProvider } from '@/contexts/ProfileContext'
import Sidebar from '@/components/Sidebar'

export const metadata: Metadata = {
  title: 'DevProgress – Technical Progression Dashboard',
  description: 'Track your technical learning progress with your team. Manage courses, tasks, and monitor team momentum.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className="font-sans antialiased"
        style={{ backgroundColor: '#0b1326', color: '#dae2fd' }}
      >
        <ProfileProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="ml-[280px] flex-1 min-h-screen">
              {children}
            </main>
          </div>
        </ProfileProvider>
      </body>
    </html>
  )
}
