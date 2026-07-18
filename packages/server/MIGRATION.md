# @vorsteh-queue/server — Migration Guide

## Breaking Changes: GraphQL Queries

### `jobs` Query

The flat `status` and `name` arguments have been replaced by a structured `where` input.

**Before:**

```graphql
query {
  jobs(
    queue: "default"
    status: FAILED
    name: "send-email"
    limit: 10
    offset: 0
  ) {
    id
    name
    status
  }
}
```

**After:**

```graphql
query {
  jobs(
    queue: "default"
    where: { status: { eq: FAILED }, name: { eq: "send-email" } }
    limit: 10
    offset: 0
  ) {
    id
    name
    status
  }
}
```

### `size` Query

`size` now accepts an optional `where` input for filtered counts.

**Before:**

```graphql
query {
  size(queue: "default")
}
```

**After:**

```graphql
# Total count (unchanged behavior)
query {
  size(queue: "default")
}

# Filtered count
query {
  size(queue: "default", where: { status: { eq: FAILED } })
}
```

## Example Queries

### Filter by status

```graphql
query {
  jobs(queue: "default", where: { status: { in: [FAILED, DEAD] } }, limit: 50) {
    id
    name
    status
    failedAt
  }
}
```

### Filter by time range

```graphql
query {
  jobs(
    queue: "default"
    where: { createdAt: { gte: "2024-01-01T00:00:00Z" } }
  ) {
    id
    name
    createdAt
  }
}
```

### Filter by name pattern

```graphql
query {
  jobs(queue: "default", where: { name: { contains: "email" } }) {
    id
    name
    status
  }
}
```

### Combined filters with AND/OR

```graphql
query {
  jobs(
    queue: "default"
    where: {
      status: { eq: FAILED }
      OR: [
        { name: { contains: "email" } }
        { name: { contains: "notification" } }
      ]
    }
  ) {
    id
    name
    status
  }
}
```

### Filter by priority and flow

```graphql
query {
  jobs(
    queue: "default"
    where: { priority: { lte: 2 }, flowId: { eq: "order-flow-123" } }
  ) {
    id
    name
    priority
  }
}
```

## Filter Input Types

```graphql
input JobWhereInput {
  AND: [JobWhereInput!]
  OR: [JobWhereInput!]
  id: StringFilter
  name: StringFilter
  uniqueKey: StringFilter
  groupKey: StringFilter
  status: JobStatusFilter
  priority: IntFilter
  attempts: IntFilter
  progress: IntFilter
  createdAt: DateTimeFilter
  processAt: DateTimeFilter
  processedAt: DateTimeFilter
  completedAt: DateTimeFilter
  failedAt: DateTimeFilter
  cancelledAt: DateTimeFilter
  cron: NullFilter
  repeatCount: IntFilter
  timeout: NullFilter
  flowId: StringFilter
  parentId: StringFilter
}

input StringFilter {
  eq: String
  neq: String
  contains: String
  startsWith: String
  like: String
  in: [String!]
  isNull: Boolean
}

input IntFilter {
  eq: Int
  neq: Int
  lt: Int
  lte: Int
  gt: Int
  gte: Int
  isNull: Boolean
}

input DateTimeFilter {
  lt: DateTime
  lte: DateTime
  gt: DateTime
  gte: DateTime
  isNull: Boolean
}

input JobStatusFilter {
  eq: JobStatus
  neq: JobStatus
  in: [JobStatus!]
}

input NullFilter {
  isNull: Boolean
}
```
