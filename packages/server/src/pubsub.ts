/**
 * Simple typed pub/sub for GraphQL subscriptions.
 *
 * Uses async generators to stream events to subscribers.
 * Designed for in-process use — events are lost if no subscriber is listening.
 */

import type { Job, QueueStats } from "@vorsteh-queue/core"

export interface PubSubEvents {
  "job:statusChanged": Job
  "stats:updated": QueueStats
}

type Listener<T> = (data: T) => void

/**
 * In-process pub/sub for subscription events.
 *
 * @example
 * ```typescript
 * const pubsub = new PubSub()
 *
 * // Publisher (from Queue/Worker event listeners)
 * pubsub.publish("job:statusChanged", job)
 *
 * // Subscriber (GraphQL subscription resolver)
 * for await (const job of pubsub.subscribe("job:statusChanged")) {
 *   yield job
 * }
 * ```
 */
export class PubSub {
  private listeners = new Map<keyof PubSubEvents, Set<Listener<unknown>>>()

  /**
   * Publish an event to all subscribers.
   *
   * @param event - Event name
   * @param data - Event payload
   */
  publish<TEvent extends keyof PubSubEvents>(
    event: TEvent,
    data: PubSubEvents[TEvent]
  ): void {
    const eventListeners = this.listeners.get(event)
    if (!eventListeners) {
      return
    }

    for (const listener of eventListeners) {
      listener(data)
    }
  }

  /**
   * Subscribe to an event stream. Returns an async iterable.
   *
   * @param event - Event name to subscribe to
   * @returns AsyncGenerator yielding events
   */
  subscribe<TEvent extends keyof PubSubEvents>(
    event: TEvent
  ): AsyncGenerator<PubSubEvents[TEvent]> {
    const queue: PubSubEvents[TEvent][] = []
    let resolveNext:
      | ((value: IteratorResult<PubSubEvents[TEvent]>) => void)
      | undefined
    let done = false

    const listener: Listener<unknown> = (data) => {
      if (done) {
        return
      }
      if (resolveNext) {
        const fn = resolveNext
        resolveNext = undefined
        fn({ value: data as PubSubEvents[TEvent], done: false })
      } else {
        queue.push(data as PubSubEvents[TEvent])
      }
    }

    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.listeners.get(event)!.add(listener as Listener<unknown>)

    // eslint-disable-next-line unicorn/no-this-assignment, @typescript-eslint/no-this-alias
    const self = this
    const generator: AsyncGenerator<PubSubEvents[TEvent]> = {
      next(): Promise<IteratorResult<PubSubEvents[TEvent]>> {
        if (queue.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          return Promise.resolve({ value: queue.shift()!, done: false })
        }
        if (done) {
          return Promise.resolve({
            value: undefined as unknown as PubSubEvents[TEvent],
            done: true,
          })
        }
        // eslint-disable-next-line promise/avoid-new
        return new Promise((resolve) => {
          resolveNext = resolve
        })
      },
      return(): Promise<IteratorResult<PubSubEvents[TEvent]>> {
        done = true
        self.listeners.get(event)?.delete(listener as Listener<unknown>)
        return Promise.resolve({
          value: undefined as unknown as PubSubEvents[TEvent],
          done: true,
        })
      },
      throw(error: unknown): Promise<IteratorResult<PubSubEvents[TEvent]>> {
        done = true
        self.listeners.get(event)?.delete(listener as Listener<unknown>)
        return Promise.reject(error)
      },
      [Symbol.asyncIterator]() {
        return this
      },
      async [Symbol.asyncDispose]() {
        done = true
        self.listeners.get(event)?.delete(listener as Listener<unknown>)
      },
    }

    return generator
  }
}
