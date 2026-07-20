import type { Metadata } from "next"

import { AppSidebar } from "@/components/app-sidebar"

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
    <html lang="en">
      <body className="flex h-screen overflow-hidden">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl p-6">{children}</div>
        </main>
      </body>
    </html>
  )
}
