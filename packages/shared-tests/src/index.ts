import { describe, expect, it } from "vitest"

import type { AdapterFactory } from "./types"

export function runSharedAdapterTests(createAdapter: AdapterFactory) {
  describe("queue basics", () => {
    it("should enqueue and dequeue", async () => {
      const adapter = await createAdapter()
      // Beispiel-Testlogik, anpassen je nach API
      expect(adapter).toBeDefined()
    })
    // Weitere generische Tests können hier ergänzt werden
  })
}
