// Exportiere die Factory für die Nutzung in den zentralen Tests
export async function createKyselyAdapter() {
  // Passe dies an die tatsächliche Adapter-Initialisierung an
  const mod = await import("../src/postgres-adapter")
  return mod.default ?? mod
}
