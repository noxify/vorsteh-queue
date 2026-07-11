import { describe, expect, it } from "vitest"

import { availableCommands, getCommandConfig } from "../src/commands-metadata"

describe("commands-metadata", () => {
  it("should list all available commands", () => {
    expect(availableCommands).toHaveLength(12)
    expect(availableCommands).toStrictEqual(
      expect.arrayContaining([
        "status",
        "inspect",
        "cancel",
        "retry",
        "redrive",
        "run-now",
        "delete",
        "clear",
        "flow",
        "queues",
        "serve",
        "doctor",
      ])
    )
  })

  it("should extract config for every available command without error", () => {
    for (const name of availableCommands) {
      const config = getCommandConfig(name)
      expect(config.name).toBe(name)
      expect(config.description).toBeTruthy()
    }
  })

  it("should throw for unknown command", () => {
    expect(() => getCommandConfig("nonexistent")).toThrow(
      "No command named 'nonexistent'"
    )
  })

  describe("status command", () => {
    it("should have --json option and no arguments", () => {
      const config = getCommandConfig("status")
      expect(config.arguments).toHaveLength(0)
      expect(config.options.find((o) => o.long === "--json")).toBeDefined()
    })
  })

  describe("cancel command", () => {
    it("should have required id argument and --reason option", () => {
      const config = getCommandConfig("cancel")

      const idArg = config.arguments.find((a) => a.name === "id")
      expect(idArg).toBeDefined()
      expect(idArg?.required).toBeTruthy()

      const reasonOpt = config.options.find((o) => o.long === "--reason")
      expect(reasonOpt).toBeDefined()
      expect(reasonOpt?.required).toBeFalsy()
    })
  })

  describe("redrive command", () => {
    it("should have optional id argument and --all/--name options", () => {
      const config = getCommandConfig("redrive")

      const idArg = config.arguments.find((a) => a.name === "id")
      expect(idArg).toBeDefined()
      expect(idArg?.required).toBeFalsy()

      expect(config.options.find((o) => o.long === "--all")).toBeDefined()
      expect(config.options.find((o) => o.long === "--name")).toBeDefined()
    })
  })

  describe("clear command", () => {
    it("should have --status and --all options", () => {
      const config = getCommandConfig("clear")

      expect(config.options.find((o) => o.long === "--status")).toBeDefined()
      expect(config.options.find((o) => o.long === "--all")).toBeDefined()
      expect(config.options.find((o) => o.long === "--json")).toBeDefined()
    })
  })

  describe("serve command", () => {
    it("should have --port and --no-dashboard options", () => {
      const config = getCommandConfig("serve")

      const portOpt = config.options.find((o) => o.long === "--port")
      expect(portOpt).toBeDefined()
      expect(portOpt?.short).toBe("-p")

      expect(
        config.options.find((o) => o.long === "--no-dashboard")
      ).toBeDefined()
    })
  })

  it("should keep option state stable across multiple extractions", () => {
    const before = getCommandConfig("redrive").options.find(
      (o) => o.long === "--all"
    )
    expect(before?.defaultValue).toBeFalsy()

    // Extract a different command
    getCommandConfig("cancel")

    const after = getCommandConfig("redrive").options.find(
      (o) => o.long === "--all"
    )
    expect(after?.defaultValue).toBeFalsy()
  })
})
