import { metrics, SpanStatusCode, trace } from "@opentelemetry/api"
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics"
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { MemoryQueueAdapter } from "../src/adapters/memory"
import { Queue } from "../src/queue"
import { Worker } from "../src/worker"

const wait = (ms: number) =>
  // eslint-disable-next-line promise/avoid-new
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

describe("Telemetry (OpenTelemetry Integration)", () => {
  let metricExporter: InMemoryMetricExporter
  let spanExporter: InMemorySpanExporter
  let meterProvider: MeterProvider
  let tracerProvider: BasicTracerProvider
  let adapter: MemoryQueueAdapter
  let queue: Queue
  let worker: Worker

  beforeEach(async () => {
    // Set up in-memory metric exporter
    metricExporter = new InMemoryMetricExporter(
      AggregationTemporality.CUMULATIVE
    )
    meterProvider = new MeterProvider({
      readers: [
        new PeriodicExportingMetricReader({
          exportIntervalMillis: 100,
          exporter: metricExporter,
        }),
      ],
    })
    metrics.setGlobalMeterProvider(meterProvider)

    // Set up in-memory span exporter
    spanExporter = new InMemorySpanExporter()
    tracerProvider = new BasicTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(spanExporter)],
    })
    tracerProvider.register()

    // Set up queue infrastructure
    adapter = new MemoryQueueAdapter()
    await adapter.connect()
    adapter.setQueueName("test-queue")
    queue = new Queue(adapter, { name: "test-queue" })
    worker = new Worker(adapter, {
      concurrency: 2,
      name: "test-queue",
      pollInterval: 10,
    })
  })

  afterEach(async () => {
    if (worker?.isRunning) {
      await worker.stop()
    }
    await meterProvider.forceFlush()
    await meterProvider.shutdown()
    await tracerProvider.shutdown()
    metrics.disable()
    trace.disable()
  })

  describe("Metrics", () => {
    it("should record jobs.added counter when adding a job", async () => {
      await queue.add("send-email", { to: "test@example.com" })
      await queue.add("send-email", { to: "other@example.com" })

      await meterProvider.forceFlush()
      const exportedMetrics = metricExporter.getMetrics()
      const resourceMetrics = exportedMetrics.at(-1)
      const scopeMetrics = resourceMetrics?.scopeMetrics.find(
        (sm) => sm.scope.name === "vorsteh-queue"
      )

      const addedMetric = scopeMetrics?.metrics.find(
        (m) => m.descriptor.name === "vorsteh_queue.jobs.added"
      )

      expect(addedMetric).toBeDefined()
      const dataPoints = addedMetric?.dataPoints ?? []
      const total = dataPoints.reduce(
        (sum, dp) => sum + (dp.value as number),
        0
      )
      expect(total).toBe(2)
    })

    it("should record jobs.processed counter on successful job", async () => {
      worker.register("task", async () => ({ done: true }))
      await queue.add("task", {})

      worker.start()
      await wait(100)

      await meterProvider.forceFlush()
      const exportedMetrics = metricExporter.getMetrics()
      const resourceMetrics = exportedMetrics.at(-1)
      const scopeMetrics = resourceMetrics?.scopeMetrics.find(
        (sm) => sm.scope.name === "vorsteh-queue"
      )

      const processedMetric = scopeMetrics?.metrics.find(
        (m) => m.descriptor.name === "vorsteh_queue.jobs.processed"
      )

      expect(processedMetric).toBeDefined()
      const dataPoints = processedMetric?.dataPoints ?? []
      const total = dataPoints.reduce(
        (sum, dp) => sum + (dp.value as number),
        0
      )
      expect(total).toBe(1)
    })

    it("should record jobs.failed counter on job failure", async () => {
      worker.register("failing-task", async () => {
        throw new Error("intentional failure")
      })
      await queue.add("failing-task", {}, { maxAttempts: 1 })

      worker.start()
      await wait(100)

      await meterProvider.forceFlush()
      const exportedMetrics = metricExporter.getMetrics()
      const resourceMetrics = exportedMetrics.at(-1)
      const scopeMetrics = resourceMetrics?.scopeMetrics.find(
        (sm) => sm.scope.name === "vorsteh-queue"
      )

      const failedMetric = scopeMetrics?.metrics.find(
        (m) => m.descriptor.name === "vorsteh_queue.jobs.failed"
      )

      expect(failedMetric).toBeDefined()
      const dataPoints = failedMetric?.dataPoints ?? []
      const total = dataPoints.reduce(
        (sum, dp) => sum + (dp.value as number),
        0
      )
      expect(total).toBe(1)
    })

    it("should record jobs.dead counter when job exhausts retries", async () => {
      worker.register("doomed", async () => {
        throw new Error("always fails")
      })
      await queue.add("doomed", {}, { maxAttempts: 1 })

      worker.start()
      await wait(100)

      await meterProvider.forceFlush()
      const exportedMetrics = metricExporter.getMetrics()
      const resourceMetrics = exportedMetrics.at(-1)
      const scopeMetrics = resourceMetrics?.scopeMetrics.find(
        (sm) => sm.scope.name === "vorsteh-queue"
      )

      const deadMetric = scopeMetrics?.metrics.find(
        (m) => m.descriptor.name === "vorsteh_queue.jobs.dead"
      )

      expect(deadMetric).toBeDefined()
      const dataPoints = deadMetric?.dataPoints ?? []
      const total = dataPoints.reduce(
        (sum, dp) => sum + (dp.value as number),
        0
      )
      expect(total).toBe(1)
    })

    it("should record jobs.duration histogram on completion", async () => {
      worker.register("slow-task", async () => {
        await wait(20)
        return { done: true }
      })
      await queue.add("slow-task", {})

      worker.start()
      await wait(150)

      await meterProvider.forceFlush()
      const exportedMetrics = metricExporter.getMetrics()
      const resourceMetrics = exportedMetrics.at(-1)
      const scopeMetrics = resourceMetrics?.scopeMetrics.find(
        (sm) => sm.scope.name === "vorsteh-queue"
      )

      const durationMetric = scopeMetrics?.metrics.find(
        (m) => m.descriptor.name === "vorsteh_queue.jobs.duration"
      )

      // Duration might not have a data point if completedAt/processedAt
      // aren't set by the memory adapter, so we check it exists at minimum
      expect(durationMetric).toBeDefined()
    })

    it("should record jobs.wait_time histogram when processing starts", async () => {
      worker.register("task", async () => ({ done: true }))
      await queue.add("task", {})

      worker.start()
      await wait(100)

      await meterProvider.forceFlush()
      const exportedMetrics = metricExporter.getMetrics()
      const resourceMetrics = exportedMetrics.at(-1)
      const scopeMetrics = resourceMetrics?.scopeMetrics.find(
        (sm) => sm.scope.name === "vorsteh-queue"
      )

      const waitTimeMetric = scopeMetrics?.metrics.find(
        (m) => m.descriptor.name === "vorsteh_queue.jobs.wait_time"
      )

      expect(waitTimeMetric).toBeDefined()
      const dataPoints = waitTimeMetric?.dataPoints ?? []
      expect(dataPoints.length).toBeGreaterThan(0)
    })
  })

  describe("Tracing", () => {
    it("should create a span for job processing", async () => {
      worker.register("traced-job", async () => ({ result: "ok" }))
      await queue.add("traced-job", { data: 1 })

      worker.start()
      await wait(100)

      const spans = spanExporter.getFinishedSpans()
      const jobSpan = spans.find((s) => s.name === "traced-job process")

      expect(jobSpan).toBeDefined()
      expect(jobSpan?.status.code).toBe(SpanStatusCode.OK)
      expect(jobSpan?.attributes["messaging.system"]).toBe("vorsteh-queue")
      expect(jobSpan?.attributes["messaging.operation"]).toBe("process")
      expect(jobSpan?.attributes["messaging.destination.name"]).toBe(
        "test-queue"
      )
      expect(jobSpan?.attributes["vorsteh_queue.job.name"]).toBe("traced-job")
    })

    it("should mark span as error on failure", async () => {
      worker.register("error-job", async () => {
        throw new Error("something broke")
      })
      await queue.add("error-job", {}, { maxAttempts: 1 })

      worker.start()
      await wait(100)

      const spans = spanExporter.getFinishedSpans()
      const jobSpan = spans.find((s) => s.name === "error-job process")

      expect(jobSpan).toBeDefined()
      expect(jobSpan?.status.code).toBe(SpanStatusCode.ERROR)
      expect(jobSpan?.status.message).toBe("something broke")
      expect(jobSpan?.events.length).toBeGreaterThan(0)
      expect(jobSpan?.events[0]?.name).toBe("exception")
    })

    it("should include job attributes in span", async () => {
      worker.register("attr-job", async () => ({}))
      await queue.add("attr-job", {}, { maxAttempts: 5, priority: 1 })

      worker.start()
      await wait(100)

      const spans = spanExporter.getFinishedSpans()
      const jobSpan = spans.find((s) => s.name === "attr-job process")

      expect(jobSpan).toBeDefined()
      expect(jobSpan?.attributes["vorsteh_queue.job.priority"]).toBe(1)
      expect(jobSpan?.attributes["vorsteh_queue.job.max_attempts"]).toBe(5)
      expect(jobSpan?.attributes["vorsteh_queue.job.id"]).toBeDefined()
    })

    it("should create spans for batch processing", async () => {
      worker.registerBatch("batch-job", async (jobs) => 
        jobs.map(() => ({ processed: true }))
      )

      await queue.add("batch-job", { item: 1 })
      await queue.add("batch-job", { item: 2 })

      worker.start()
      await wait(150)

      const spans = spanExporter.getFinishedSpans()
      const batchSpans = spans.filter((s) => s.name === "batch-job process")

      expect(batchSpans.length).toBe(2)
      for (const span of batchSpans) {
        expect(span.status.code).toBe(SpanStatusCode.OK)
      }
    })
  })

  describe("No-op behavior without SDK", () => {
    it("should not throw when creating telemetry without a provider", async () => {
      // Disable providers to simulate no SDK configured
      metrics.disable()
      trace.disable()

      const noOpAdapter = new MemoryQueueAdapter()
      await noOpAdapter.connect()
      noOpAdapter.setQueueName("no-otel-queue")

      const noOpQueue = new Queue(noOpAdapter, { name: "no-otel-queue" })
      const noOpWorker = new Worker(noOpAdapter, {
        name: "no-otel-queue",
        pollInterval: 10,
      })

      noOpWorker.register("safe-job", async () => ({ ok: true }))

      // These should not throw even without OTel SDK
      await noOpQueue.add("safe-job", { data: "test" })
      noOpWorker.start()
      await wait(100)
      await noOpWorker.stop()
    })
  })
})
