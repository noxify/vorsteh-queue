// Exportiere die Factory für die Nutzung in den zentralen Tests
export async function createPrismaAdapter() {
  // Passe dies an die tatsächliche Adapter-Initialisierung an
  const mod = await import("../src/postgres-adapter")
  return mod.default ?? mod
}
