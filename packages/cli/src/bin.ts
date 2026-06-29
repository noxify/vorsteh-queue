#!/usr/bin/env node

/**
 * vorsteh-queue CLI entry point.
 */

import { defineCommand, runMain } from "citty"

import { createCancelCommand } from "./commands/cancel"
import { createClearCommand } from "./commands/clear"
import { createDeleteCommand } from "./commands/delete"
import { createFlowCommand } from "./commands/flow"
import { createInspectCommand } from "./commands/inspect"
import { createRedriveCommand } from "./commands/redrive"
import { createRetryCommand } from "./commands/retry"
import { createRunNowCommand } from "./commands/run-now"
import { createStatusCommand } from "./commands/status"
import { createGraphQLTransport } from "./transport/graphql"

// Default to GraphQL transport via environment variables
// eslint-disable-next-line no-restricted-properties
const url = process.env.VORSTEH_QUEUE_URL ?? "http://localhost:3000/graphql"
// eslint-disable-next-line no-restricted-properties
const token = process.env.VORSTEH_QUEUE_TOKEN

const transport = createGraphQLTransport(url, token)

const main = defineCommand({
  meta: {
    name: "vorsteh-queue",
    version: "0.1.0",
    description: "CLI for monitoring and managing vorsteh-queue jobs",
  },
  subCommands: {
    status: createStatusCommand(transport),
    inspect: createInspectCommand(transport),
    cancel: createCancelCommand(transport),
    retry: createRetryCommand(transport),
    redrive: createRedriveCommand(transport),
    "run-now": createRunNowCommand(transport),
    delete: createDeleteCommand(transport),
    clear: createClearCommand(transport),
    flow: createFlowCommand(transport),
  },
})

void runMain(main)
