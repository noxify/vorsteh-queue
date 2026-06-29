/**
 * Lightweight typed event emitter used by both Queue and Worker.
 *
 * Provides type-safe event subscription and emission with support for
 * one-time listeners and listener cleanup.
 *
 * @template TEvents - Object type mapping event names to their payload types
 *
 * @example
 * ```typescript
 * interface MyEvents {
 *   "item:added": { id: string }
 *   "item:removed": { id: string }
 * }
 *
 * class MyEmitter extends TypedEventEmitter<MyEvents> {
 *   add(id: string) {
 *     this.emit("item:added", { id })
 *   }
 * }
 * ```
 */
export class TypedEventEmitter<TEvents extends object> {
  private listeners = new Map<keyof TEvents, Set<(data: never) => void>>()

  /**
   * Register an event listener.
   *
   * @param event - Event name to listen for
   * @param listener - Callback invoked when the event fires
   */
  on<TEvent extends keyof TEvents>(
    event: TEvent,
    listener: (data: TEvents[TEvent]) => void
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)?.add(listener as (data: never) => void)
  }

  /**
   * Remove an event listener.
   *
   * @param event - Event name to stop listening for
   * @param listener - The exact callback reference to remove
   */
  off<TEvent extends keyof TEvents>(
    event: TEvent,
    listener: (data: TEvents[TEvent]) => void
  ): void {
    this.listeners.get(event)?.delete(listener as (data: never) => void)
  }

  /**
   * Register a one-time event listener that auto-removes after first invocation.
   *
   * @param event - Event name to listen for
   * @param listener - Callback invoked once when the event fires
   */
  once<TEvent extends keyof TEvents>(
    event: TEvent,
    listener: (data: TEvents[TEvent]) => void
  ): void {
    const wrapper = (data: TEvents[TEvent]): void => {
      this.off(event, wrapper)
      listener(data)
    }
    this.on(event, wrapper)
  }

  /**
   * Emit an event to all registered listeners.
   *
   * @param event - Event name to emit
   * @param data - Event payload to pass to listeners
   */
  protected emit<TEvent extends keyof TEvents>(
    event: TEvent,
    data: TEvents[TEvent]
  ): void {
    const eventListeners = this.listeners.get(event)
    if (!eventListeners) {
      return
    }

    for (const listener of eventListeners) {
      ;(listener as (data: TEvents[TEvent]) => void)(data)
    }
  }

  /**
   * Remove all listeners for a specific event, or all listeners entirely.
   *
   * @param event - Optional event name. If omitted, removes all listeners for all events.
   */
  removeAllListeners(event?: keyof TEvents): void {
    if (event) {
      this.listeners.delete(event)
    } else {
      this.listeners.clear()
    }
  }
}
