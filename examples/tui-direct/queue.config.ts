/**
 * CLI configuration for direct mode.
 *
 * The dashboard command reads this file to connect directly to the adapter.
 * Only needed when running the dashboard as a separate process (production setup).
 */
import {
  createAdapter,
  dataQueue,
  deploymentQueue,
  emailQueue,
  notificationQueue,
} from "./src/queues"

export default {
  adapter: createAdapter(),
  defaultQueue: "email",
  queues: [emailQueue, dataQueue, notificationQueue, deploymentQueue],
}
