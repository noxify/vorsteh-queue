import { MemoryQueueAdapter, Queue, Worker } from "@vorsteh-queue/core"

/**
 * Flow Producer Example: Deploy Pipeline
 *
 * Tree structure:
 *   deploy (parent, waits for children)
 *   +-- build:linux (leaf)
 *   +-- build:macos (leaf)
 *   +-- test (mid-level, waits for its child)
 *       +-- lint (leaf)
 *
 * Execution order: lint -> test -> build:linux + build:macos (parallel) -> deploy
 */

const adapter = new MemoryQueueAdapter()
const queue = new Queue(adapter, { name: "deploy-queue" })
const worker = new Worker(adapter, {
  name: "deploy-queue",
  concurrency: 4,
  pollInterval: 20,
})

// Register handlers
worker.register("build", async (job) => {
  const { target } = job.payload as { target: string }
  console.log(`[build] Building for ${target}...`)
  await new Promise((resolve) => setTimeout(resolve, 300))
  console.log(`[build] Build for ${target} complete`)
  return { artifact: `dist/${target}/app`, target }
})

worker.register("lint", async () => {
  console.log("[lint] Running linter...")
  await new Promise((resolve) => setTimeout(resolve, 100))
  console.log("[lint] No issues found")
  return { issues: 0 }
})

worker.register("test", async (_job, ctx) => {
  console.log("[test] Running tests...")
  const childResults = await ctx.getChildrenResults?.()
  console.log(`[test] All ${childResults?.size ?? 0} prerequisite(s) passed`)
  await new Promise((resolve) => setTimeout(resolve, 200))
  return { passed: true, prerequisites: childResults?.size ?? 0 }
})

worker.register("deploy", async (_job, ctx) => {
  console.log("[deploy] Deploying...")
  const childResults = await ctx.getChildrenResults?.()
  console.log(`[deploy] All ${childResults?.size ?? 0} children completed`)
  return { deployed: true, version: "1.2.0" }
})

async function main() {
  console.log("=== Flow Producer Example: Deploy Pipeline ===\n")
  await queue.connect()

  // Create the flow tree
  const flow = await queue.addFlow({
    name: "deploy",
    payload: { version: "1.2.0" },
    children: [
      { name: "build", payload: { target: "linux" } },
      { name: "build", payload: { target: "macos" } },
      {
        name: "test",
        payload: {},
        children: [{ name: "lint", payload: {} }],
      },
    ],
  })

  console.log(`Flow created: ${flow.id}`)
  console.log(
    `Root job (deploy): ${flow.job.id} [status: ${flow.job.status}]\n`
  )

  // Start processing
  worker.start()

  // Wait for completion
  await new Promise((resolve) => setTimeout(resolve, 2000))

  // Show final tree
  const tree = await queue.getFlowTree(flow.id)
  if (tree) {
    console.log("\n=== Final Flow Tree ===")
    printTree(tree)
  }

  const rootJob = await queue.getJob(flow.job.id)
  console.log(`\nDeploy result:`, rootJob?.result)

  await worker.stop()
  await queue.disconnect()
}

function printTree(
  node: { job: { name: string; status: string }; children: readonly unknown[] },
  indent = ""
) {
  const icon =
    node.job.status === "completed" ? "[done]" : `[${node.job.status}]`
  console.log(`${indent}${node.job.name} ${icon}`)
  for (const child of node.children as (typeof node)[]) {
    printTree(child, `${indent}  `)
  }
}

main().catch(console.error)
