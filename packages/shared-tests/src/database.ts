import { PostgreSqlContainer } from "@testcontainers/postgresql"

// TODO: make schema customizable
// ref: https://github.com/dajudge/testcontainers-examples/blob/master/src/test/java/com/dajudge/testcontainers/examples/PostgreSQLTests.java
export async function initDatabase(version = 17) {
  const container = await new PostgreSqlContainer(`postgres:${version}`)
    .withEnvironment({
      POSTGRES_PASSWORD: "testpassword",
      POSTGRES_USER: "testuser",
      POSTGRES_DB: "testdb",
    })
    .withExposedPorts(5432)
    .withStartupTimeout(60000)
    .start()

  return {
    container,
    host: container.getHost(),
    port: container.getMappedPort(5432),
    dbName: "testdb",
    username: "testuser",
    password: "testpassword",
    version,
  }
}
