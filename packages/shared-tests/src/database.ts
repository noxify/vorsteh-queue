import { PostgreSqlContainer } from "@testcontainers/postgresql"

// eslint-disable-next-line no-warning-comments
// TODO: make schema customizable
// ref: https://github.com/dajudge/testcontainers-examples/blob/master/src/test/java/com/dajudge/testcontainers/examples/PostgreSQLTests.java
export async function initDatabase(version = 17) {
  const container = await new PostgreSqlContainer(`postgres:${version}`)
    .withEnvironment({
      POSTGRES_DB: "testdb",
      POSTGRES_PASSWORD: "testpassword",
      POSTGRES_USER: "testuser",
    })
    .withExposedPorts(5432)
    .withStartupTimeout(60_000)
    .start()

  return {
    container,
    dbName: "testdb",
    host: container.getHost(),
    password: "testpassword",
    port: container.getMappedPort(5432),
    username: "testuser",
    version,
  }
}
