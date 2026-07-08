import { QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider } from "@tanstack/react-router"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { configReady, getRouter } from "./router"

const rootElement = document.querySelector("#root")
if (!rootElement) {
  throw new Error("Root element not found")
}

// Wait for server config before rendering so the API client is initialized
// oxlint-disable-next-line promise/prefer-await-to-then -- top-level await not available in browser entry point
configReady.then(() => {
  const router = getRouter()

  createRoot(rootElement).render(
    <StrictMode>
      <QueryClientProvider client={router.options.context.queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>
  )
})
