import type React from "react"

import { DocsHeader } from "~/components/docs-header"
import { DocsSidebar } from "~/components/docs-sidebar"
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar"

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen={true} collapsible="icon">
      <DocsSidebar />
      {/* DocsHeader is now outside SidebarInset for full width */}
      <DocsHeader />
      <SidebarInset className="pt-16">
        {" "}
        {/* Add pt-16 to push content below the fixed header */}
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
