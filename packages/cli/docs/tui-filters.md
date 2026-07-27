# TUI Filters → JobWhereInput Mapping

The TUI Jobs view exposes three filter controls that map directly to `JobWhereInput` fields.

## Filter Controls

| TUI Control | Input Method | Maps To |
| --- | --- | --- |
| Status filter | Tab through statuses (1-8 keys) | `status: { eq: <status> }` |
| Name filter | Type `/` to enter name search | `name: { contains: <input> }` |
| Time range | Cycle with `t` key | `createdAt: { gte: <calculated date> }` |

## How Filters Combine

All active filters are combined with implicit AND. The TUI constructs a `JobWhereInput` like this:

```typescript
const where: JobWhereInput = {
  // Only included when a status tab is active (not "all")
  ...(activeFilter !== "all" && { status: { eq: activeFilter } }),

  // Only included when user has typed a name filter
  ...(nameFilter && { name: { contains: nameFilter } }),

  // Only included when a time range is selected (not "all time")
  ...(activeTimeRange.ms > 0 && {
    createdAt: {
      gte: new Date(Date.now() - activeTimeRange.ms).toISOString(),
    },
  }),
}
```

## Status Filter

The status filter cycles through available job statuses:

- `all` — no status filter applied
- `pending` — `{ status: { eq: "pending" } }`
- `delayed` — `{ status: { eq: "delayed" } }`
- `processing` — `{ status: { eq: "processing" } }`
- `completed` — `{ status: { eq: "completed" } }`
- `failed` — `{ status: { eq: "failed" } }`
- `cancelled` — `{ status: { eq: "cancelled" } }`
- `dead` — `{ status: { eq: "dead" } }`
- `waiting-children` — `{ status: { eq: "waiting-children" } }`

## Name Filter

When the user activates the name filter input (pressing `/`) and types a search string, it maps to:

```typescript
{
  name: {
    contains: "user-typed-text"
  }
}
```

This performs a substring match — jobs whose name contains the typed text will be shown.

## Time Range Filter

The time range filter cycles through predefined ranges:

| Label         | Duration   | Where Clause                          |
| ------------- | ---------- | ------------------------------------- |
| All time      | —          | _(no filter)_                         |
| Last 5 min    | 5 minutes  | `{ createdAt: { gte: <now - 5m> } }`  |
| Last 15 min   | 15 minutes | `{ createdAt: { gte: <now - 15m> } }` |
| Last 1 hour   | 1 hour     | `{ createdAt: { gte: <now - 1h> } }`  |
| Last 24 hours | 24 hours   | `{ createdAt: { gte: <now - 24h> } }` |
| Last 7 days   | 7 days     | `{ createdAt: { gte: <now - 7d> } }`  |

The `gte` value is recalculated on each refresh cycle, so it always represents a rolling window.

## Size (Pagination Total)

The same `where` filter is passed to `transport.size(where)` to get an accurate filtered total for pagination display. This ensures the "showing X of Y" indicator reflects the currently filtered set.

## Server-Side Filtering

All filtering happens server-side. The TUI sends the `JobWhereInput` through the transport layer (either direct adapter access or GraphQL), and the server/adapter applies the filter at the database level. No client-side filtering is performed for status, name, or time range.
