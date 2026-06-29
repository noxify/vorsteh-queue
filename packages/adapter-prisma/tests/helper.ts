import { execSync } from "node:child_process"
import path from "node:path"

/**
 * Push the Prisma test schema to the database.
 *
 * Uses `prisma db push` CLI with `--url` flag to pass the Testcontainer URL directly.
 * This is the most reliable approach across Prisma versions since the programmatic
 * Migrate API is internal and changes frequently between versions.
 */
export async function prepareTable() {
  try {
    const schemaPath = path.join(
      import.meta.dirname,
      "../prisma/schema.test.prisma"
    )
    // eslint-disable-next-line no-restricted-properties
    const databaseUrl = process.env.DATABASE_URL

    if (!databaseUrl) {
      throw new Error("DATABASE_URL environment variable is not set")
    }

    execSync(
      `npx prisma db push --schema=${schemaPath} --url="${databaseUrl}" --accept-data-loss`,
      {
        stdio: "pipe",
        // eslint-disable-next-line no-restricted-properties
        env: { ...process.env },
      }
    )

    return { result: true }
  } catch (error) {
    const stderr = (error as { stderr?: Buffer })?.stderr?.toString() ?? ""
    // eslint-disable-next-line no-console
    console.error(
      "Migration error:",
      stderr || (error instanceof Error ? error.message : error)
    )
    return { result: false, error }
  }
}
