import { graphql } from "gql.tada"

export const CancelJobMutation = graphql(`
  mutation CancelJob($id: ID!, $reason: String) {
    cancelJob(id: $id, reason: $reason)
  }
`)

export const RetryJobMutation = graphql(`
  mutation RetryJob($id: ID!) {
    retryJob(id: $id)
  }
`)

export const RedriveJobMutation = graphql(`
  mutation RedriveJob($id: ID!) {
    redriveJob(id: $id)
  }
`)

export const RedriveAllMutation = graphql(`
  mutation RedriveAll($name: String) {
    redriveAll(name: $name)
  }
`)

export const RunJobNowMutation = graphql(`
  mutation RunJobNow($id: ID!) {
    runJobNow(id: $id)
  }
`)

export const DeleteJobMutation = graphql(`
  mutation DeleteJob($id: ID!) {
    deleteJob(id: $id)
  }
`)

export const ClearJobsMutation = graphql(`
  mutation ClearJobs($status: JobStatus) {
    clearJobs(status: $status)
  }
`)
