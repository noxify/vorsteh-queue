import { MemoryQueueAdapter, Queue, Worker } from "@vorsteh-queue/core"

/**
 * Saga Compensation Example: Order Checkout Pipeline
 *
 * Steps: reserve-stock -> charge-payment -> ship-order
 * If any step fails, all previous steps are compensated in reverse order.
 */

const adapter = new MemoryQueueAdapter()
const queue = new Queue(adapter, { name: "saga-queue" })
const worker = new Worker(adapter, { name: "saga-queue", concurrency: 1 })

// Simulate external services
const inventory = {
  reserve: async (items: string[]) => {
    console.log(`  [inventory] Reserving ${items.length} items`)
    return { reservationId: `res_${Date.now()}` }
  },
  release: async (reservationId: string) => {
    console.log(`  [inventory] Releasing reservation ${reservationId}`)
  },
}

const payments = {
  charge: async (amount: number) => {
    console.log(`  [payments] Charging $${amount}`)
    return { txId: `tx_${Date.now()}` }
  },
  refund: async (txId: string) => {
    console.log(`  [payments] Refunding transaction ${txId}`)
  },
}

const shipping = {
  createOrder: async (_reservationId: string) => {
    // Simulate shipping failure for demo
    throw new Error("Shipping service unavailable")
  },
}

// Register the checkout handler with saga compensation
worker.register("checkout", async (job, { step }) => {
  const { items, amount } = job.payload as { items: string[]; amount: number }

  // Step 1: Reserve inventory (with compensation)
  const reservation = await step.run(
    "reserve-stock",
    async () => inventory.reserve(items),
    {
      compensate: async (result) => {
        await inventory.release(result.reservationId)
      },
    }
  )

  // Step 2: Charge payment (with compensation)
  const payment = await step.run(
    "charge-payment",
    async () => payments.charge(amount),
    {
      compensate: async (result) => {
        await payments.refund(result.txId)
      },
    }
  )

  // Step 3: Ship order (this will fail -> triggers compensations)
  await step.run("ship-order", async () =>
    shipping.createOrder(reservation.reservationId)
  )

  return { orderId: `order_${Date.now()}`, txId: payment.txId }
})

async function main() {
  console.log("=== Saga Compensation Example ===\n")
  await queue.connect()

  worker.on("job:failed", (job) => {
    console.log(`\nJob failed: ${job.error?.message}`)
  })

  worker.on("job:dead", (job) => {
    console.log(`Job moved to DLQ: ${job.id}`)
  })

  // Add the checkout job (will fail at shipping, triggering compensations)
  await queue.add(
    "checkout",
    {
      items: ["widget-a", "widget-b"],
      amount: 99.99,
    },
    { maxAttempts: 1 }
  )

  worker.start()

  // Wait for processing
  await new Promise((resolve) => setTimeout(resolve, 1000))

  console.log("\n=== Result ===")
  console.log("The shipping step failed, so compensations ran in reverse:")
  console.log("  1. Payment was refunded")
  console.log("  2. Inventory reservation was released")

  await worker.stop()
  await queue.disconnect()
}

main().catch(console.error)
