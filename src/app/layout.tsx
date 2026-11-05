import type { Metadata } from 'next'
import './globals.css'
import { ProfileProvider } from '@/contexts/ProfileContext'
import { SidebarProvider } from '@/contexts/SidebarContext'
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
          <SidebarProvider>
            <div className="flex min-h-screen">
              <Sidebar />
              <main className="ml-0 md:ml-[280px] flex-1 min-h-screen w-full min-w-0 overflow-x-hidden">
                {children}
              </main>
            </div>
          </SidebarProvider>
        </ProfileProvider>
      </body>
    </html>
  )
}
