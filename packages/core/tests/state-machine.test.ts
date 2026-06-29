import { describe, expect, it } from "vitest"

import { InvalidTransitionError } from "../src/errors"
import {
  isTerminalStatus,
  isValidTransition,
  validateTransition,
} from "../src/state-machine"

describe("state-machine", () => {
  describe(validateTransition, () => {
    it("should allow pending → processing", () => {
      expect(() => validateTransition("pending", "processing")).not.toThrow()
    })

    it("should allow pending → cancelled", () => {
      expect(() => validateTransition("pending", "cancelled")).not.toThrow()
    })

    it("should allow delayed → pending", () => {
      expect(() => validateTransition("delayed", "pending")).not.toThrow()
    })

    it("should allow delayed → cancelled", () => {
      expect(() => validateTransition("delayed", "cancelled")).not.toThrow()
    })

    it("should allow processing → completed", () => {
      expect(() => validateTransition("processing", "completed")).not.toThrow()
    })

    it("should allow processing → failed", () => {
      expect(() => validateTransition("processing", "failed")).not.toThrow()
    })

    it("should allow processing → cancelled", () => {
      expect(() => validateTransition("processing", "cancelled")).not.toThrow()
    })

    it("should allow failed → pending (retry)", () => {
      expect(() => validateTransition("failed", "pending")).not.toThrow()
    })

    it("should allow failed → dead (DLQ)", () => {
      expect(() => validateTransition("failed", "dead")).not.toThrow()
    })

    it("should allow failed → cancelled", () => {
      expect(() => validateTransition("failed", "cancelled")).not.toThrow()
    })

    it("should allow dead → pending (redrive)", () => {
      expect(() => validateTransition("dead", "pending")).not.toThrow()
    })

    it("should throw on completed → processing", () => {
      expect(() => validateTransition("completed", "processing")).toThrow(
        InvalidTransitionError
      )
    })

    it("should throw on cancelled → pending", () => {
      expect(() => validateTransition("cancelled", "pending")).toThrow(
        InvalidTransitionError
      )
    })

    it("should throw on pending → completed (skipping processing)", () => {
      expect(() => validateTransition("pending", "completed")).toThrow(
        InvalidTransitionError
      )
    })

    it("should throw on dead → completed", () => {
      expect(() => validateTransition("dead", "completed")).toThrow(
        InvalidTransitionError
      )
    })

    it("should include from/to in error", () => {
      try {
        validateTransition("completed", "processing")
      } catch (error) {
        /* eslint-disable vitest/no-conditional-expect */
        expect(error).toBeInstanceOf(InvalidTransitionError)
        const err = error as InvalidTransitionError
        expect(err.from).toBe("completed")
        expect(err.to).toBe("processing")
        expect(err.message).toContain("completed")
        expect(err.message).toContain("processing")
        /* eslint-enable vitest/no-conditional-expect */
      }
    })
  })

  describe(isValidTransition, () => {
    it("should return true for valid transitions", () => {
      expect(isValidTransition("pending", "processing")).toBeTruthy()
      expect(isValidTransition("processing", "completed")).toBeTruthy()
      expect(isValidTransition("failed", "dead")).toBeTruthy()
    })

    it("should return false for invalid transitions", () => {
      expect(isValidTransition("completed", "pending")).toBeFalsy()
      expect(isValidTransition("cancelled", "processing")).toBeFalsy()
      expect(isValidTransition("pending", "dead")).toBeFalsy()
    })
  })

  describe(isTerminalStatus, () => {
    it("should return true for terminal statuses", () => {
      expect(isTerminalStatus("completed")).toBeTruthy()
      expect(isTerminalStatus("cancelled")).toBeTruthy()
      expect(isTerminalStatus("dead")).toBeFalsy() // dead can go to pending via redrive
    })

    it("should return false for active statuses", () => {
      expect(isTerminalStatus("pending")).toBeFalsy()
      expect(isTerminalStatus("delayed")).toBeFalsy()
      expect(isTerminalStatus("processing")).toBeFalsy()
      expect(isTerminalStatus("failed")).toBeFalsy()
    })
  })
})
