import {
  adapter,
  emailQueue,
  imageQueue,
  reportQueue,
} from "./src/shared/queue"

export default {
  adapter,
  defaultQueue: "email-queue",
  queues: [emailQueue, imageQueue, reportQueue],
}
