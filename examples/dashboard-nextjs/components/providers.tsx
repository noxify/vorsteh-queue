"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "next-themes"
import { NuqsAdapter } from "nuqs/adapters/next/app"
import { useMemo } from "react"

import { TooltipProvider } from "@/components/ui/tooltip"

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 3000,
          },
        },
      }),
    []
  )

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <NuqsAdapter>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>{children}</TooltipProvider>
        </QueryClientProvider>
      </NuqsAdapter>
    </ThemeProvider>
  )
}
