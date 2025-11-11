import queueConfig from "@/lib/queue-config-loader"
import { createFileRoute } from "@tanstack/react-router"
import { json } from "@tanstack/react-start"

export const Route = createFileRoute("/api/overview")({
  server: {
    handlers: {
      GET: async () => {
        const existingQueues = await queueConfig()

        const stats = {
          queues: existingQueues.length,
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
          cancelled: 0,
        }

        existingQueues.forEach(async (queue) => {
          const queueStats = await queue.getStats()
          stats.pending += queueStats.pending
          stats.processing += queueStats.processing
          stats.completed += queueStats.completed
          stats.failed += queueStats.failed
          stats.delayed += queueStats.delayed
          // stats.cancelled += queueStats.cancelled
        })

        return json(stats)
      },
    },
  },
})
