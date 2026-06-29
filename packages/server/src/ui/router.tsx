import { QueryClient } from "@tanstack/react-query"
import { createRouter } from "@tanstack/react-router"

import { configureDashboard } from "./lib/api-client"
import { routeTree } from "./routeTree.gen"

// Initialize API client from localStorage on startup
const endpoint = localStorage.getItem("vq-endpoint") ?? "/graphql"
const token = localStorage.getItem("vq-token") ?? undefined
configureDashboard({ endpoint, token: token || undefined })

export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5000,
        refetchInterval: 10_000,
      },
    },
  })

  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    context: { queryClient },
    defaultPreload: "intent",
  })

  return router
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
