import { QueryClient } from "@tanstack/react-query"
import { createRouter } from "@tanstack/react-router"

import { configureDashboard } from "./lib/api-client"
import { routeTree } from "./routeTree.gen"

/**
 * Fetch dashboard configuration from the server and initialize the API client.
 * The server's /api/config endpoint provides the GraphQL endpoint path.
 */
async function initializeConfig(): Promise<void> {
  try {
    const response = await fetch("/api/config")
    if (response.ok) {
      const serverConfig = (await response.json()) as {
        graphqlEndpoint?: string
      }

      const graphqlPath = serverConfig.graphqlEndpoint ?? "/graphql"
      const endpoint = graphqlPath.startsWith("http")
        ? graphqlPath
        : `${window.location.origin}${graphqlPath}`

      configureDashboard({ endpoint })
      return
    }
  } catch {
    // Config endpoint unavailable — use default
  }

  configureDashboard({ endpoint: `${window.location.origin}/graphql` })
}

/** Promise that resolves once the config is loaded */
export const configReady = initializeConfig()

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
