import { MemoryQueueAdapter, Queue, Worker } from "@vorsteh-queue/core"
import { createQueueServer } from "@vorsteh-queue/server"

/**
 * GraphQL Server Example
 *
 * Starts a standalone GraphQL API for queue monitoring.
 * Protected with token authentication.
 *
 * Try: http://localhost:3000/graphql
 * Header: Authorization: Bearer my-secret-token
 *
 * Query example:
 *   { stats { pending completed failed } }
 *   { job(id: "...") { name status payload } }
 */

const adapter = new MemoryQueueAdapter()
const queue = new Queue(adapter, { name: "demo-queue" })
const worker = new Worker(adapter, {
  name: "demo-queue",
  concurrency: 2,
  pollInterval: 100,
})

// Register a sample handler
worker.register("demo-task", async (job) => {
  await new Promise((resolve) => setTimeout(resolve, 500))
  return { processed: true, payload: job.payload }
})

async function main() {
  await queue.connect()

  // Add some sample jobs
  for (let i = 1; i <= 5; i += 1) {
    await queue.add("demo-task", { item: i })
  }

  // Start processing
  worker.start()

  // Start the GraphQL server
  const server = createQueueServer({
    adapter,
    queueName: "demo-queue",
    port: 3000,
    auth: { tokens: ["my-secret-token"] },
  })

  await server.start()
  console.log("\nGraphQL endpoint: http://localhost:3000/graphql")
  console.log("Auth header: Authorization: Bearer my-secret-token")
  console.log("\nExample queries:")
  console.log("  { stats { pending completed failed dead } }")
  console.log("  { deadJobs { id name } }")
  console.log("  mutation { clearJobs(status: completed) }")

  process.on("SIGINT", async () => {
    await worker.stop()
    await server.stop()
    process.exit(0)
  })
}

main().catch(console.error)
