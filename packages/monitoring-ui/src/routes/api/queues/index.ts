import queueConfig from "@/lib/queue-config-loader"
import { createFileRoute } from "@tanstack/react-router"
import { json } from "@tanstack/react-start"

export const Route = createFileRoute("/api/queues/")({
  server: {
    handlers: {
      GET: async () => {
        const existingQueues = await queueConfig()

        const transformedQueues = await Promise.all(
          existingQueues.map(async (queue) => {
            const config = queue.getConfig()
            const stats = await queue.getStats()
            return {
              config,
              stats,
            }
          }),
        )
        return json(transformedQueues)
      },
    },
  },
})
