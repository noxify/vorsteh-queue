import { MemoryQueueAdapter, Queue } from "@vorsteh-queue/core"

export const adapter = new MemoryQueueAdapter()
export const queue = new Queue(adapter, { name: "demo-queue" })
