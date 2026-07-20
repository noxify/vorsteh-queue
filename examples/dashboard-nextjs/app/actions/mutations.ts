"use server"

import { revalidatePath } from "next/cache"

import { getQueueClient } from "@/lib/queue-client"

export async function cancelJob(id: string, queue?: string) {
  const client = await getQueueClient(queue)
  await client.cancelJob(id)
  revalidatePath("/")
}

export async function retryJob(id: string, queue?: string) {
  const client = await getQueueClient(queue)
  await client.retryJob(id)
  revalidatePath("/")
}

export async function redriveJob(id: string, queue?: string) {
  const client = await getQueueClient(queue)
  await client.redriveJob(id)
  revalidatePath("/")
}

export async function redriveAllDeadJobs(queue?: string) {
  const client = await getQueueClient(queue)
  await client.redriveAllDeadJobs()
  revalidatePath("/")
}

export async function runJobNow(id: string, queue?: string) {
  const client = await getQueueClient(queue)
  await client.runJobNow(id)
  revalidatePath("/")
}

export async function deleteJob(id: string, queue?: string) {
  const client = await getQueueClient(queue)
  await client.deleteJob(id)
  revalidatePath("/")
}
