import type { FlowNode } from "@vorsteh-queue/core"
import { defineCommand } from "citty"
import consola from "consola"

import type { Transport } from "../transport/types"

const STATUS_ICONS: Record<string, string> = {
  pending: "○",
  delayed: "◷",
  processing: "⟳",
  completed: "✓",
  failed: "✗",
  cancelled: "⊘",
  dead: "☠",
  "waiting-children": "⏳",
}

function renderTree(node: FlowNode, prefix = "", isLast = true): string {
  const icon = STATUS_ICONS[node.job.status] ?? "?"
  const connector = prefix === "" ? "" : isLast ? "└── " : "├── "
  const statusColor = node.job.status === "completed" ? "✓" : icon

  let line = `${prefix}${connector}${node.job.name} (${node.job.status}) ${statusColor}`

  if (node.job.result) {
    line += "  [done]"
  }

  const lines = [line]
  const childPrefix = prefix + (prefix === "" ? "" : isLast ? "    " : "│   ")

  for (let i = 0; i < node.children.length; i += 1) {
    const child = node.children[i]
    if (!child) {
      continue
    }
    const childIsLast = i === node.children.length - 1
    lines.push(renderTree(child, childPrefix, childIsLast))
  }

  return lines.join("\n")
}

export function createFlowCommand(transport: Transport) {
  return defineCommand({
    meta: {
      name: "flow",
      description: "Show a flow tree (parent-child job hierarchy)",
    },
    args: {
      id: {
        type: "positional",
        description: "Flow ID to inspect",
        required: true,
      },
      json: { type: "boolean", description: "Output as JSON", default: false },
    },
    async run({ args }) {
      await transport.connect()
      const tree = await transport.getFlowTree(args.id)
      await transport.disconnect()

      if (!tree) {
        consola.error(`Flow "${args.id}" not found`)
        return
      }

      if (args.json) {
        consola.log(JSON.stringify(tree, null, 2))
        return
      }

      consola.info(`Flow: ${tree.job.name}  [flow-id: ${args.id}]`)
      consola.log("")
      consola.log(renderTree(tree))
    },
  })
}
