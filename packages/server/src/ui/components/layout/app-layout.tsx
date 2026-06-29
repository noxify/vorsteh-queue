import { Sidebar } from "./sidebar"

/**
 * Main application layout with sidebar and content area.
 */
export function AppLayout({
  children,
}: {
  readonly children: React.ReactNode
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl p-6">{children}</div>
      </main>
    </div>
  )
}
