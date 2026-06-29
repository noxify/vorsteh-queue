import { graphql } from "gql.tada"

export const StatsQuery = graphql(`
  query Stats {
    stats {
      pending
      delayed
      processing
      completed
      failed
      cancelled
      dead
    }
  }
`)

export const JobsQuery = graphql(`
  query Jobs($status: JobStatus, $name: String, $limit: Int, $offset: Int) {
    jobs(status: $status, name: $name, limit: $limit, offset: $offset) {
      id
      name
      status
      priority
      attempts
      maxAttempts
      progress
      createdAt
      groupKey
    }
  }
`)

export const JobDetailQuery = graphql(`
  query JobDetail($id: ID!) {
    job(id: $id) {
      id
      name
      payload
      status
      priority
      attempts
      maxAttempts
      progress
      groupKey
      uniqueKey
      cron
      cancellationReason
      createdAt
      processAt
      processedAt
      completedAt
      failedAt
      cancelledAt
      result
      error {
        name
        message
        stack
      }
    }
  }
`)

export const DeadJobsQuery = graphql(`
  query DeadJobs($limit: Int, $offset: Int) {
    deadJobs(limit: $limit, offset: $offset) {
      id
      name
      status
      attempts
      maxAttempts
      failedAt
      error {
        message
      }
    }
  }
`)

export const FlowsQuery = graphql(`
  query Flows($limit: Int, $offset: Int) {
    flows(limit: $limit, offset: $offset) {
      flowId
      rootJob {
        id
        name
        status
        createdAt
      }
    }
  }
`)

/**
 * Flow tree query with 5 levels of nesting.
 * For deeper trees, the visualization would be impractical anyway.
 */
export const FlowTreeQuery = graphql(`
  query FlowTree($flowId: String!) {
    flowTree(flowId: $flowId) {
      job {
        id
        name
        status
      }
      children {
        job {
          id
          name
          status
        }
        children {
          job {
            id
            name
            status
          }
          children {
            job {
              id
              name
              status
            }
            children {
              job {
                id
                name
                status
              }
              children {
                job {
                  id
                  name
                  status
                }
              }
            }
          }
        }
      }
    }
  }
`)
