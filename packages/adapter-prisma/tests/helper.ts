import path from "path"
import PrismaInternals from "@prisma/internals"
import PrismaMigrate from "@prisma/migrate"

// based on
// https://github.com/prisma/prisma/issues/13549#issuecomment-1987343945
export async function prepareTable() {
  let migrate

  try {
    const schemaPathResult = await PrismaInternals.getSchemaWithPath(
      path.join(__dirname, "../prisma/schema.test.prisma"),
    )

    if (!schemaPathResult.schemaPath) {
      // eslint-disable-next-line no-console
      console.error("No schema found")
      return { result: false }
    }

    const migrationsDirPath = path.join(schemaPathResult.schemaRootDir, "migrations")
    const schemaContext = { schemaFiles: schemaPathResult.schemas } as PrismaInternals.SchemaContext

    migrate = await PrismaMigrate.Migrate.setup({
      migrationsDirPath,
      schemaContext,
    })

    await migrate.push({ force: true })

    return { result: true }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log({ error })
    return { result: false, error }
  } finally {
    void migrate?.stop()
  }
}
