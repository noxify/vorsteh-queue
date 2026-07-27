import { describe, expect, it, vi } from "vitest"

import { TypedEventEmitter } from "../src/events"

interface TestEvents {
  "item:added": { id: string }
  "item:removed": { id: string }
  "count:changed": number
}

class TestEmitter extends TypedEventEmitter<TestEvents> {
  trigger<TEvent extends keyof TestEvents>(
    event: TEvent,
    data: TestEvents[TEvent]
  ): void {
    this.emit(event, data)
  }
}

describe(TypedEventEmitter, () => {
  it("should call listener when event is emitted", () => {
    const emitter = new TestEmitter()
    const listener = vi.fn<(data: TestEvents["item:added"]) => void>()

    emitter.on("item:added", listener)
    emitter.trigger("item:added", { id: "123" })

    expect(listener).toHaveBeenCalledExactlyOnceWith({ id: "123" })
  })

  it("should support multiple listeners for same event", () => {
    const emitter = new TestEmitter()
    const listener1 = vi.fn<(data: TestEvents["item:added"]) => void>()
    const listener2 = vi.fn<(data: TestEvents["item:added"]) => void>()

    emitter.on("item:added", listener1)
    emitter.on("item:added", listener2)
    emitter.trigger("item:added", { id: "abc" })

    expect(listener1).toHaveBeenCalledWith({ id: "abc" })
    expect(listener2).toHaveBeenCalledWith({ id: "abc" })
  })

  it("should not call listeners for other events", () => {
    const emitter = new TestEmitter()
    const addedListener = vi.fn<(data: TestEvents["item:added"]) => void>()
    const removedListener = vi.fn<(data: TestEvents["item:removed"]) => void>()

    emitter.on("item:added", addedListener)
    emitter.on("item:removed", removedListener)
    emitter.trigger("item:added", { id: "123" })

    expect(addedListener).toHaveBeenCalledOnce()
    expect(removedListener).not.toHaveBeenCalled()
  })

  it("should remove listener with off()", () => {
    const emitter = new TestEmitter()
    const listener = vi.fn<(data: TestEvents["item:added"]) => void>()

    emitter.on("item:added", listener)
    emitter.off("item:added", listener)
    emitter.trigger("item:added", { id: "123" })

    expect(listener).not.toHaveBeenCalled()
  })

  it("should call once() listener only once", () => {
    const emitter = new TestEmitter()
    const listener = vi.fn<(data: TestEvents["item:added"]) => void>()

    emitter.once("item:added", listener)
    emitter.trigger("item:added", { id: "first" })
    emitter.trigger("item:added", { id: "second" })

    expect(listener).toHaveBeenCalledExactlyOnceWith({ id: "first" })
  })

  it("should remove all listeners for a specific event", () => {
    const emitter = new TestEmitter()
    const listener1 = vi.fn<(data: TestEvents["item:added"]) => void>()
    const listener2 = vi.fn<(data: TestEvents["item:added"]) => void>()

    emitter.on("item:added", listener1)
    emitter.on("item:added", listener2)
    emitter.removeAllListeners("item:added")
    emitter.trigger("item:added", { id: "123" })

    expect(listener1).not.toHaveBeenCalled()
    expect(listener2).not.toHaveBeenCalled()
  })

  it("should remove all listeners when no event specified", () => {
    const emitter = new TestEmitter()
    const addedListener = vi.fn<(data: TestEvents["item:added"]) => void>()
    const countListener = vi.fn<(data: TestEvents["count:changed"]) => void>()

    emitter.on("item:added", addedListener)
    emitter.on("count:changed", countListener)
    emitter.removeAllListeners()
    emitter.trigger("item:added", { id: "123" })
    emitter.trigger("count:changed", 5)

    expect(addedListener).not.toHaveBeenCalled()
    expect(countListener).not.toHaveBeenCalled()
  })

  it("should handle emitting with no listeners gracefully", () => {
    const emitter = new TestEmitter()
    expect(() => emitter.trigger("item:added", { id: "123" })).not.toThrow()
  })

  it("should handle numeric event data", () => {
    const emitter = new TestEmitter()
    const listener = vi.fn<(data: TestEvents["count:changed"]) => void>()

    emitter.on("count:changed", listener)
    emitter.trigger("count:changed", 42)

    expect(listener).toHaveBeenCalledWith(42)
  })
})
