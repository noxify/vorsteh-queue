const createMockQueue = (name: string) => {
  let lastStats: Record<string, number> | null = null

  function generateStats() {
    return {
      pending: Math.floor(Math.random() * 50),
      processing: Math.floor(Math.random() * 10),
      completed: Math.floor(Math.random() * 200),
      failed: Math.floor(Math.random() * 5),
      delayed: Math.floor(Math.random() * 5),
      cancelled: Math.floor(Math.random() * 2),
    }
  }

  return {
    getConfig: () => ({
      name,
      maxTimeout: 30000,
      concurrency: 5,
      retryLimit: 3,
    }),
    getStats: () => {
      lastStats = generateStats()
      return lastStats
    },
    getJobs: () => {
      lastStats = generateStats()
      const now = Date.now()
      const jobs = []
      const statusList = Object.keys(lastStats) as (keyof typeof lastStats)[]
      let jobCounter = 1
      for (const status of statusList) {
        const count = lastStats[status] ?? 0
        for (let i = 0; i < count; i++) {
          const baseTime = now - i * 10000 - jobCounter * 1000
          jobs.push({
            id: `job-${baseTime}-${jobCounter}`,
            name: `${name}-job-${jobCounter}`,
            status,
            progress:
              status === "completed"
                ? 100
                : status === "processing"
                  ? Math.floor(Math.random() * 80) + 10
                  : 0,
            maxAttempts: 3,
            attempts: status === "failed" ? 3 : status === "processing" ? 2 : 1,
            createdAt: new Date(baseTime),
            processAt: new Date(baseTime + 1000),
            processedAt: ["processing", "completed", "failed", "cancelled"].includes(status)
              ? new Date(baseTime + 2000)
              : null,
            failedAt: status === "failed" ? new Date(baseTime + 7000) : null,
            completedAt: status === "completed" ? new Date(baseTime + 8000) : null,
          })
          jobCounter++
        }
      }
      return jobs
    },
    get: (id: string) => ({
      id,
      status: "completed",
      createdAt: new Date(Date.now() - 60000).toISOString(),
      startedAt: new Date(Date.now() - 50000).toISOString(),
      completedAt: new Date(Date.now() - 10000).toISOString(),
      payload: { example: "payload data" },
      result: { success: true, data: "Job result" },
      error: null,
      retries: 0,
    }),
  }
}

export default [
  createMockQueue("email-queue"),
  createMockQueue("video-processing-queue"),
  createMockQueue("data-import-queue"),
  createMockQueue("report-generation-queue"),
  createMockQueue("notification-queue"),
]
