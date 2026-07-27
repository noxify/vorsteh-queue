import { MemoryQueueAdapter, Queue, Worker } from "@vorsteh-queue/core"

/**
 * Human-in-the-Loop Example: Expense Approval Workflow
 *
 * 1. Employee submits expense
 * 2. Job pauses, waiting for manager approval signal
 * 3. Manager approves/rejects (external signal)
 * 4. Job resumes and processes the decision
 */

const adapter = new MemoryQueueAdapter()
const queue = new Queue(adapter, { name: "approval-queue" })
const worker = new Worker(adapter, { name: "approval-queue", pollInterval: 50 })

worker.register("expense-request", async (job, { step }) => {
  const { employeeId, amount, description } = job.payload as {
    employeeId: string
    amount: number
    description: string
  }

  // Step 1: Submit the expense
  await step.run("submit", async () => {
    console.log(
      `[submit] Expense submitted by ${employeeId}: $${amount} - ${description}`
    )
    console.log(`[submit] Waiting for manager approval...`)
    return { submittedAt: new Date().toISOString() }
  })

  // Step 2: Wait for manager decision (pauses the job)
  const decision = await step.waitFor<{ approved: boolean; comment?: string }>(
    "wait-approval",
    "manager-decision"
  )

  // Step 3: Process the decision
  const result = await step.run("process-decision", async () => {
    if (decision.approved) {
      console.log(
        `[process] Expense APPROVED. Processing reimbursement of $${amount}`
      )
      return { amount, status: "reimbursed" }
    }
    console.log(
      `[process] Expense REJECTED. Reason: ${decision.comment ?? "No reason given"}`
    )
    return { reason: decision.comment, status: "rejected" }
  })

  return result
})

async function main() {
  console.log("=== Human-in-the-Loop Signal Example ===\n")
  await queue.connect()

  // Add the expense request
  const job = await queue.add("expense-request", {
    amount: 250,
    description: "Conference ticket",
    employeeId: "emp-42",
  })

  console.log(`Job created: ${job.id}\n`)

  // Start worker
  worker.start()
  await new Promise((resolve) => setTimeout(resolve, 200))

  // At this point, the job is paused waiting for the signal
  console.log("\n--- Simulating manager approval (2 seconds later) ---\n")
  await new Promise((resolve) => setTimeout(resolve, 2000))

  // Manager sends approval signal
  const signaled = await queue.signal(job.id, "manager-decision", {
    approved: true,
    comment: "Looks good, approved!",
  })
  console.log(`Signal sent: ${signaled}\n`)

  // Wait for job to complete
  await new Promise((resolve) => setTimeout(resolve, 500))

  const completed = await queue.getJob(job.id)
  console.log("\n=== Final Result ===")
  console.log(`Status: ${completed?.status}`)
  console.log(`Result:`, completed?.result)

  await worker.stop()
  await queue.disconnect()
}

main().catch(console.error)
