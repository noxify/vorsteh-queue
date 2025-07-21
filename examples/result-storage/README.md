# Result Storage Example

This example demonstrates how to use job results in Vorsteh Queue. Job handlers can return values that are automatically stored in the database and made available through events and job records.

## Features Demonstrated

- **Result Storage**: Job handlers return results that are automatically stored
- **Type Safety**: Full TypeScript support for job payloads and results
- **Progress Tracking**: Real-time progress updates during job processing
- **Error Handling**: Proper error collection and reporting in results
- **Event Access**: Accessing results through job completion events

## Running the Example

```bash
pnpm install
pnpm start
```

## Key Concepts

### Job Handler Results

```typescript
interface ProcessDataResult {
  processed: number
  failed: number
  duration: number
  errors: string[]
}

queue.register<ProcessDataPayload, ProcessDataResult>("process-data", async (job) => {
  // Process data...
  
  // Return result - automatically stored in job.result field
  return {
    processed: 45,
    failed: 5,
    duration: 1250,
    errors: ["Failed to process item-23"]
  }
})
```

### Accessing Results

Results are available in job completion events:

```typescript
queue.on("job:completed", (job) => {
  console.log("Job result:", job.result)
  // Result is typed according to your handler's return type
})
```

### Database Storage

Results are stored as JSON in the database `result` field and can be queried later for analytics, debugging, or reporting purposes.