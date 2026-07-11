import { Worker } from "@vorsteh-queue/core"

import { client } from "./database"
import { adapter, queue } from "./queues"

const worker = new Worker(adapter, {
  name: "event-queue",
  concurrency: 2,
  pollInterval: 50,
})

// Register handlers
worker.register("reliable-task", async (job) => {
  await new Promise((resolve) => setTimeout(resolve, 1000))
  return { success: true, data: job.payload }
})

worker.register("unreliable-task", async () => {
  await new Promise((resolve) => setTimeout(resolve, 500))
  if (Math.random() < 0.5) {
    throw new Error("Random failure occurred")
  }
  return { success: true }
})

// Producer events (emitted on Queue)
queue.on("job:added", (job) => {
  console.log(`[event] job:added - ${job.name} (${job.id})`)
})

// Consumer events (emitted on Worker)
worker.on("job:processing", (job) => {
  console.log(`[event] job:processing - ${job.name} (${job.id})`)
})

worker.on("job:completed", (job) => {
  console.log(`[event] job:completed - ${job.name} (${job.id})`)
})

worker.on("job:failed", (job) => {
  console.log(`[event] job:failed - ${job.name}: ${job.error?.message}`)
})

worker.on("job:retried", (job) => {
  console.log(`[event] job:retried - ${job.name} (attempt ${job.attempts})`)
})

worker.on("job:progress", (job) => {
  console.log(`[event] job:progress - ${job.name}: ${job.progress}%`)
})

worker.on("worker:started", () => {
  console.log("[event] worker:started")
})

worker.on("worker:stopped", () => {
  console.log("[event] worker:stopped")
})

async function main() {
  console.log("Starting Event System Example")
  await queue.connect()

  await queue.add("reliable-task", { message: "hello" })
  await queue.add("unreliable-task", { attempt: 1 }, { maxAttempts: 3 })

  worker.start()
  console.log("Press Ctrl+C to stop.\n")

  process.on("SIGINT", async () => {
    await worker.stop()
    await queue.disconnect()
    await client.end()
    process.exit(0)
  })
}

main().catch(console.error)
