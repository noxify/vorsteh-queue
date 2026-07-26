import type { FlowTree } from "@vorsteh-queue/core"
import consola from "consola"

import { buildFlowCommandStructure } from "../metadata/flow-metadata"
import type { GlobalOptions } from "../transport/with-transport"
import { withTransport } from "../transport/with-transport"

const STATUS_ICONS: Record<string, string> = {
  cancelled: "⊘",
  completed: "✓",
  failed: "✗",
  ready: "○",
  waiting: "⏳",
}

function renderTree(tree: FlowTree, prefix = "", isLast = true): string {
  const icon = STATUS_ICONS[tree.node.status] ?? "?"
  const connector = prefix === "" ? "" : isLast ? "└── " : "├── "
  let line = `${prefix}${connector}${tree.node.name} (${tree.node.status}) ${icon}`

  if (tree.node.result) {
    line += "  [done]"
  }

  const lines = [line]
  const childPrefix = prefix + (prefix === "" ? "" : isLast ? "    " : "│   ")

  for (let i = 0; i < tree.children.length; i += 1) {
    const child = tree.children[i]
    if (!child) {
      continue
    }
    const childIsLast = i === tree.children.length - 1
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
      { queue: globalOpts.queue, token: globalOpts.token, url: globalOpts.url },
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

        consola.info(`Flow: ${tree.node.name}  [flow-id: ${id}]`)
        consola.log("")
        consola.log(renderTree(tree))
      }
    )
  })

  return command
}
