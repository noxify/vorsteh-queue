#!/usr/bin/env node

/**
 * vorsteh-queue CLI entry point.
 */

import { Command } from "@commander-js/extra-typings"
import consola from "consola"

import { createCancelCommand } from "./commands/cancel"
import { createClearCommand } from "./commands/clear"
import { createDeleteCommand } from "./commands/delete"
import { createDoctorCommand } from "./commands/doctor"
import { createFlowCommand } from "./commands/flow"
import { createInspectCommand } from "./commands/inspect"
import { createRedriveCommand } from "./commands/redrive"
import { createRetryCommand } from "./commands/retry"
import { createRunNowCommand } from "./commands/run-now"
import { createServeCommand } from "./commands/serve"
import { createStatusCommand } from "./commands/status"
import { createTokenOption, createUrlOption } from "./options"

const program = new Command()

program
  .name("vorsteh-queue")
  .version("0.1.0")
  .description("CLI for monitoring and managing vorsteh-queue jobs")
  .configureHelp({ sortSubcommands: true })
  .addOption(createUrlOption())
  .addOption(createTokenOption())
  .addCommand(createServeCommand())
  .addCommand(createStatusCommand())
  .addCommand(createInspectCommand())
  .addCommand(createCancelCommand())
  .addCommand(createRetryCommand())
  .addCommand(createRedriveCommand())
  .addCommand(createRunNowCommand())
  .addCommand(createDeleteCommand())
  .addCommand(createClearCommand())
  .addCommand(createFlowCommand())
  .addCommand(createDoctorCommand())

try {
  await program.parseAsync()
} catch (error: unknown) {
  const debug = process.env.DEBUG

  if (error instanceof Error) {
    consola.error(`\nError: ${error.message}`)
    if (debug) {
      consola.error(error)
    }
  } else {
    consola.error("\nAn unknown error occurred.")
    if (debug) {
      consola.error(error)
    }
  }

  process.exitCode = 1
}
