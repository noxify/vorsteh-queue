import {
  adapter,
  emailQueue,
  imageQueue,
  reportQueue,
} from "./src/shared/queue"

export default {
  adapter,
  queues: [emailQueue, imageQueue, reportQueue],
  defaultQueue: "email-queue",
}
