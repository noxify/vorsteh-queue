/**
 * Command metadata extractor for documentation.
 * This module is isolated from CLI runtime dependencies to avoid bundling
 * Node.js-specific packages into browser/SSR builds.
 *
 * All commands are built from clean metadata structures that don't include
 * action handlers or runtime dependencies.
 */
import type { Argument, Option } from "@commander-js/extra-typings"

import { buildCancelCommandStructure } from "./metadata/cancel-metadata"
import { buildClearCommandStructure } from "./metadata/clear-metadata"
import { buildDeleteCommandStructure } from "./metadata/delete-metadata"
import { buildDoctorCommandStructure } from "./metadata/doctor-metadata"
import { buildFlowCommandStructure } from "./metadata/flow-metadata"
import { buildInspectCommandStructure } from "./metadata/inspect-metadata"
import { buildQueuesCommandStructure } from "./metadata/queues-metadata"
import { buildRedriveCommandStructure } from "./metadata/redrive-metadata"
import { buildRetryCommandStructure } from "./metadata/retry-metadata"
import { buildRunNowCommandStructure } from "./metadata/run-now-metadata"
import { buildServeCommandStructure } from "./metadata/serve-metadata"
import { buildStatusCommandStructure } from "./metadata/status-metadata"

type AvailableCommand =
  | "cancel"
  | "clear"
  | "delete"
  | "doctor"
  | "flow"
  | "inspect"
  | "queues"
  | "redrive"
  | "retry"
  | "run-now"
  | "serve"
  | "status"

export interface CommandArgumentMeta {
  name: string
  description: string
  required: boolean
  variadic: boolean
  defaultValue?: unknown
  defaultValueDescription?: string
}

export interface CommandOptionMeta {
  flags: string
  description: string
  required: boolean
  defaultValue?: unknown
  defaultValueDescription?: string
  envVar?: string
  isBoolean: boolean
  long?: string
  short?: string
}

export interface CommandConfig {
  name: string
  description: string
  arguments: readonly CommandArgumentMeta[]
  options: readonly CommandOptionMeta[]
}

function extractArgumentMeta(arg: Argument): CommandArgumentMeta {
  const meta: CommandArgumentMeta = {
    name: arg.name(),
    description: arg.description,
    required: arg.required,
    variadic: arg.variadic,
  }

  if (arg.defaultValue !== undefined) {
    meta.defaultValue = arg.defaultValue
  }
  if (arg.defaultValueDescription) {
    meta.defaultValueDescription = arg.defaultValueDescription
  }

  return meta
}

function extractOptionMeta(option: Option): CommandOptionMeta {
  const meta: CommandOptionMeta = {
    flags: option.flags,
    description: option.description,
    required: option.mandatory,
    isBoolean: !option.required && !option.optional,
  }

  if (option.defaultValue !== undefined && !option.defaultValueDescription) {
    meta.defaultValue = option.defaultValue
  }
  if (option.defaultValueDescription) {
    meta.defaultValueDescription = option.defaultValueDescription
  }
  if (option.envVar) {
    meta.envVar = option.envVar
  }
  if (option.long) {
    meta.long = option.long
  }
  if (option.short) {
    meta.short = option.short
  }

  return meta
}

const commandFactories: Record<string, () => unknown> = {
  cancel: buildCancelCommandStructure,
  clear: buildClearCommandStructure,
  delete: buildDeleteCommandStructure,
  doctor: buildDoctorCommandStructure,
  flow: buildFlowCommandStructure,
  inspect: buildInspectCommandStructure,
  queues: buildQueuesCommandStructure,
  redrive: buildRedriveCommandStructure,
  retry: buildRetryCommandStructure,
  "run-now": buildRunNowCommandStructure,
  serve: buildServeCommandStructure,
  status: buildStatusCommandStructure,
}

/**
 * Extract metadata from a registered command by name.
 *
 * @param commandName - The command name to extract metadata for
 * @returns The command configuration including name, description, arguments, and options
 * @throws {Error} If no command with the given name exists
 *
 * @example
 * ```typescript
 * const config = getCommandConfig("cancel")
 * // { name: "cancel", description: "Cancel a job", arguments: [...], options: [...] }
 * ```
 */
export function getCommandConfig(commandName: string): CommandConfig {
  const commandFn = commandFactories[commandName]

  if (!commandFn) {
    throw new Error(`No command named '${commandName}'`)
  }

  const command = commandFn() as {
    name: () => string
    description: () => string
    registeredArguments: Argument[]
    options: Option[]
  }

  return {
    name: command.name(),
    description: command.description(),
    arguments: command.registeredArguments.map(extractArgumentMeta),
    options: command.options.map(extractOptionMeta),
  }
}

/** All available CLI command names. */
export const availableCommands: readonly AvailableCommand[] = Object.keys(
  commandFactories
) as AvailableCommand[]
