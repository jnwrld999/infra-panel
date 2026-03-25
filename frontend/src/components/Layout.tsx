import { Sidebar } from './Sidebar'

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto min-w-0">{children}</main>
    </div>
  )
}
