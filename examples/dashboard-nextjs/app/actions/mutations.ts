"use server"

import { revalidatePath } from "next/cache"

import { getQueueClient } from "@/lib/queue-client"

export async function cancelJob(id: string) {
  const client = await getQueueClient()
  await client.cancelJob(id)
  revalidatePath("/")
}

export async function retryJob(id: string) {
  const client = await getQueueClient()
  await client.retryJob(id)
  revalidatePath("/")
}

export async function redriveJob(id: string) {
  const client = await getQueueClient()
  await client.redriveJob(id)
  revalidatePath("/")
}

export async function redriveAllDeadJobs() {
  const client = await getQueueClient()
  await client.redriveAllDeadJobs()
  revalidatePath("/")
}

export async function runJobNow(id: string) {
  const client = await getQueueClient()
  await client.runJobNow(id)
  revalidatePath("/")
}

export async function deleteJob(id: string) {
  const client = await getQueueClient()
  await client.deleteJob(id)
  revalidatePath("/")
}
