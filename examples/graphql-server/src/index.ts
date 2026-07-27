import { Worker } from "@vorsteh-queue/core"
import { createQueueServer } from "@vorsteh-queue/server"

import { adapter, queue } from "./queues"

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
 *   { stats(queue: "demo-queue") { pending completed failed } }
 *   { job(id: "...") { name status payload } }
 */

const worker = new Worker(adapter, {
  concurrency: 2,
  name: "demo-queue",
  pollInterval: 100,
})

// Register a sample handler
worker.register("demo-task", async (job) => {
  await new Promise((resolve) => setTimeout(resolve, 500))
  return { payload: job.payload, processed: true }
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
    auth: { tokens: ["my-secret-token"] },
    port: 3000,
    queues: [queue],
  })

  await server.start()
  console.log("\nGraphQL endpoint: http://localhost:3000/graphql")
  console.log("Auth header: Authorization: Bearer my-secret-token")
  console.log("\nExample queries:")
  console.log(
    '  { stats(queue: "demo-queue") { pending completed failed dead } }'
  )
  console.log('  { deadJobs(queue: "demo-queue") { id name } }')
  console.log(
    '  mutation { clearJobs(queue: "demo-queue", status: completed) }'
  )

  process.on("SIGINT", async () => {
    await worker.stop()
    await server.stop()
    process.exit(0)
  })
}

main().catch(console.error)
