---
"@vorsteh-queue/core": minor
---

# 🚀 Initial Release - Core Queue Engine

The foundational package providing the core queue functionality and interfaces.

## ✨ Features

- **Type-safe job processing** with full TypeScript support and generic job payloads
- **Priority queue system** with numeric priority (lower = higher priority)
- **Delayed job scheduling** for future execution with precise timing
- **Recurring jobs** with cron expressions and interval-based repetition
- **Timezone-aware scheduling** with automatic DST handling
- **Real-time progress tracking** for long-running jobs (0-100%)
- **Comprehensive event system** for monitoring job lifecycle
- **Graceful shutdown** with clean job processing termination

## 🎛️ Queue Configuration

- **Flexible job cleanup** - `removeOnComplete`/`removeOnFail` support boolean or number
- **Configurable concurrency** - Process multiple jobs simultaneously
- **Retry logic** with exponential backoff and max attempts
- **Job timeouts** and comprehensive error handling
- **Queue statistics** and health monitoring

## 📊 Event System

- **Job lifecycle events**: `job:added`, `job:processing`, `job:completed`, `job:failed`, `job:retried`, `job:progress`
- **Queue events**: `queue:paused`, `queue:resumed`, `queue:stopped`, `queue:error`
- **Type-safe event handlers** with proper TypeScript support

## 🌍 Timezone Support

- Schedule jobs in any IANA timezone with automatic DST transitions
- Complex cron expressions with timezone awareness
- UTC-first storage with timezone-aware calculations
- Reliable cross-timezone job scheduling

## 🔌 Adapter Pattern

- **Pluggable storage backends** - Easy to add new database adapters
- **Consistent interface** - Same API across all storage implementations
- **Built-in memory adapter** - Perfect for testing and development
- **Transaction support** - Atomic job operations where supported