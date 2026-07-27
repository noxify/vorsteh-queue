/**
 * Structured error for user-facing CLI messages.
 * Caught by the top-level error boundary and displayed without stack traces.
 */
export class CLIError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CLIError"
  }
}
