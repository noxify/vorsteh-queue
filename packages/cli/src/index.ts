/**
 * vorsteh-queue/cli
 *
 * CLI tool for monitoring and managing vorsteh-queue jobs.
 * Supports both direct adapter connection and remote GraphQL transport.
 *
 * @example
 * ```bash
 * # Show queue status
 * vorsteh-queue status
 *
 * # Inspect a job
 * vorsteh-queue inspect <job-id>
 *
 * # Cancel a job
 * vorsteh-queue cancel <job-id> --reason "no longer needed"
 *
 * # Redrive dead jobs
 * vorsteh-queue redrive --all
 * vorsteh-queue redrive <job-id>
 *
 * # Clear completed jobs
 * vorsteh-queue clear --status completed
 * ```
 */

export { loadCliConfig } from "./config"
export type {
  CliTransport,
  DirectTransportConfig,
  GraphQLTransportConfig,
} from "./config"

export { createDirectTransport } from "./transport/direct"
export { createGraphQLTransport } from "./transport/graphql"
export type { Transport } from "./transport/types"

export { createStatusCommand } from "./commands/status"
export { createInspectCommand } from "./commands/inspect"
export { createCancelCommand } from "./commands/cancel"
export { createRetryCommand } from "./commands/retry"
export { createRedriveCommand } from "./commands/redrive"
export { createRunNowCommand } from "./commands/run-now"
export { createDeleteCommand } from "./commands/delete"
export { createClearCommand } from "./commands/clear"
export { createFlowCommand } from "./commands/flow"

export { availableCommands, getCommandConfig } from "./commands-metadata"
export type {
  CommandArgumentMeta,
  CommandConfig,
  CommandOptionMeta,
} from "./commands-metadata"
