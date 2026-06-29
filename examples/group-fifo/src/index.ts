import { MemoryQueueAdapter, Queue, Worker } from "@vorsteh-queue/core"

/**
 * Group FIFO Example: Per-Tenant Ordered Processing
 *
 * Jobs within the same group (tenant) are processed sequentially.
 * Different groups are processed in parallel.
 */

const adapter = new MemoryQueueAdapter()
const queue = new Queue(adapter, { name: "tenant-queue" })
const worker = new Worker(adapter, {
  name: "tenant-queue",
  concurrency: 4,
  pollInterval: 10,
})

worker.register("process-order", async (job) => {
  const { tenantId, orderId } = job.payload as {
    tenantId: string
    orderId: number
  }
  const start = Date.now()
  console.log(`[${tenantId}] Processing order #${orderId}...`)
  await new Promise((resolve) => setTimeout(resolve, 200))
  console.log(`[${tenantId}] Order #${orderId} done (${Date.now() - start}ms)`)
  return { tenantId, orderId, processedAt: Date.now() }
})

async function main() {
  console.log("=== Group FIFO Example ===")
  console.log("Jobs within same tenant process sequentially.")
  console.log("Different tenants process in parallel.\n")
  await queue.connect()

  // Add jobs for 3 tenants, 3 orders each
  for (let order = 1; order <= 3; order += 1) {
    await queue.add(
      "process-order",
      { tenantId: "tenant-A", orderId: order },
      { group: "tenant-A" }
    )
    await queue.add(
      "process-order",
      { tenantId: "tenant-B", orderId: order },
      { group: "tenant-B" }
    )
    await queue.add(
      "process-order",
      { tenantId: "tenant-C", orderId: order },
      { group: "tenant-C" }
    )
  }

  console.log("9 jobs added (3 tenants x 3 orders)\n")

  worker.start()
  await new Promise((resolve) => setTimeout(resolve, 2000))

  console.log(
    "\nAll jobs processed. Within each tenant, orders ran sequentially."
  )

  await worker.stop()
  await queue.disconnect()
}

main().catch(console.error)
