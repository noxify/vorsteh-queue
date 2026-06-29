#!/usr/bin/env node

/**
 * vorsteh-queue CLI entry point.
 */

import { Command } from "@commander-js/extra-typings"

import { createCancelCommand } from "./commands/cancel"
import { createClearCommand } from "./commands/clear"
import { createDeleteCommand } from "./commands/delete"
import { createFlowCommand } from "./commands/flow"
import { createInspectCommand } from "./commands/inspect"
import { createRedriveCommand } from "./commands/redrive"
import { createRetryCommand } from "./commands/retry"
import { createRunNowCommand } from "./commands/run-now"
import { createServeCommand } from "./commands/serve"
import { createStatusCommand } from "./commands/status"
import { createGraphQLTransport } from "./transport/graphql"

// Default to GraphQL transport via environment variables
// eslint-disable-next-line no-restricted-properties
const url = process.env.VORSTEH_QUEUE_URL ?? "http://localhost:3000/graphql"
// eslint-disable-next-line no-restricted-properties
const token = process.env.VORSTEH_QUEUE_TOKEN

const transport = createGraphQLTransport(url, token)

const program = new Command()

program
  .name("vorsteh-queue")
  .version("0.1.0")
  .description("CLI for monitoring and managing vorsteh-queue jobs")
  .configureHelp({ sortSubcommands: true })
  .addCommand(createServeCommand())
  .addCommand(createStatusCommand(transport))
  .addCommand(createInspectCommand(transport))
  .addCommand(createCancelCommand(transport))
  .addCommand(createRetryCommand(transport))
  .addCommand(createRedriveCommand(transport))
  .addCommand(createRunNowCommand(transport))
  .addCommand(createDeleteCommand(transport))
  .addCommand(createClearCommand(transport))
  .addCommand(createFlowCommand(transport))

try {
  await program.parseAsync()
} catch (error: unknown) {
  // eslint-disable-next-line no-restricted-properties
  process.exitCode = 1
  throw error
}
