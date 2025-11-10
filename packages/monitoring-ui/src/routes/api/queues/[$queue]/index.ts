import queueConfig from "@/lib/queue-config-loader"
import { createFileRoute, notFound } from "@tanstack/react-router"
import { json } from "@tanstack/react-start"

export const Route = createFileRoute("/api/queues/$queue/")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const existingQueues = await queueConfig()

        const transformedQueue = existingQueues.find((ele) => ele.getConfig().name == params.queue)

        if (!transformedQueue) {
          notFound()
        }

        const config = transformedQueue?.getConfig()
        const stats = await transformedQueue?.getStats()
        return json({
          config,
          stats,
        })
      },
    },
  },
})
