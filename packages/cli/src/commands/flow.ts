import type { FlowNode } from "@vorsteh-queue/core"
import consola from "consola"

import { buildFlowCommandStructure } from "../metadata/flow-metadata"
import type { GlobalOptions } from "../transport/with-transport"
import { withTransport } from "../transport/with-transport"

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

export function createFlowCommand() {
  const command = buildFlowCommandStructure()

  command.action(async (id, options) => {
    const globalOpts = command.optsWithGlobals() as GlobalOptions &
      typeof options

    await withTransport(
      { url: globalOpts.url, token: globalOpts.token, queue: globalOpts.queue },
      async (transport) => {
        const tree = await transport.getFlowTree(id)

        if (!tree) {
          consola.error(`Flow "${id}" not found`)
          return
        }

        if (options.json) {
          consola.log(JSON.stringify(tree, null, 2))
          return
        }

        consola.info(`Flow: ${tree.job.name}  [flow-id: ${id}]`)
        consola.log("")
        consola.log(renderTree(tree))
      }
    )
  })

  return command
}
