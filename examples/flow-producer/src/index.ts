import { FlowProducer, MemoryQueueAdapter, Worker } from "@vorsteh-queue/core"

/**
 * Flow Producer Example: Deploy Pipeline
 *
 * Tree structure:
 *   deploy (parent, waits for children)
 *   ├── build:linux (leaf)
 *   ├── build:macos (leaf)
 *   └── test (mid-level, waits for its child)
 *       └── lint (leaf)
 *
 * Execution order: lint → test, build:linux, build:macos (parallel) → deploy
 */

const adapter = new MemoryQueueAdapter()
const flowProducer = new FlowProducer(adapter)
const worker = new Worker(adapter, {
  concurrency: 4,
  name: "deploy-queue",
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
  const childResults = await ctx.flow?.getChildrenValues()
  console.log(`[test] All ${childResults?.size ?? 0} prerequisite(s) passed`)
  await new Promise((resolve) => setTimeout(resolve, 200))
  return { passed: true, prerequisites: childResults?.size ?? 0 }
})

worker.register("deploy", async (_job, ctx) => {
  console.log("[deploy] Deploying...")
  const childResults = await ctx.flow?.getChildrenValues()
  console.log(`[deploy] All ${childResults?.size ?? 0} children completed`)
  return { deployed: true, version: "1.2.0" }
})

async function main() {
  console.log("=== Flow Producer Example: Deploy Pipeline ===\n")
  await adapter.connect()

  // Create the flow tree
  const flow = await flowProducer.add({
    name: "deploy",
    queueName: "deploy-queue",
    payload: { version: "1.2.0" },
    children: [
      {
        name: "build",
        queueName: "deploy-queue",
        payload: { target: "linux" },
      },
      {
        name: "build",
        queueName: "deploy-queue",
        payload: { target: "macos" },
      },
      {
        name: "test",
        queueName: "deploy-queue",
        payload: {},
        children: [{ name: "lint", queueName: "deploy-queue", payload: {} }],
      },
    ],
  })

  console.log(`Flow created: ${flow.flowId}`)
  console.log(
    `Root node (deploy): ${flow.rootNode.id} [status: ${flow.rootNode.status}]\n`
  )

  // Start processing
  worker.start()

  // Wait for completion
  await new Promise((resolve) => setTimeout(resolve, 2000))

  // Show final tree
  const tree = await flowProducer.getFlow(flow.flowId)
  if (tree) {
    console.log("\n=== Final Flow Tree ===")
    printTree(tree)
  }

  await worker.stop()
  await adapter.disconnect()
}

function printTree(
  tree: {
    node: { name: string; status: string }
    children: readonly unknown[]
  },
  indent = ""
) {
  const icon =
    tree.node.status === "completed" ? "[done]" : `[${tree.node.status}]`
  console.log(`${indent}${tree.node.name} ${icon}`)
  for (const child of tree.children as (typeof tree)[]) {
    printTree(child, `${indent}  `)
  }
}

main().catch(console.error)
