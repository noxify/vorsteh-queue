import type { Metadata } from "next"

import { AppSidebar } from "@/components/app-sidebar"
import { Providers } from "@/components/providers"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

import "./globals.css"

export const metadata: Metadata = {
  title: "Vorsteh Queue Dashboard",
  description: "Monitor and manage your job queue",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              <div className="p-6">{children}</div>
            </SidebarInset>
          </SidebarProvider>
        </Providers>
      </body>
    </html>
  )
}
