/* eslint-disable @typescript-eslint/no-explicit-any */
import postgres from "postgres"

/**
 * Mock ZenStack client for integration testing.
 *
 * ZenStack v3 requires `zen generate` to produce typed clients from a ZModel
 * schema. Since we cannot run the full ZenStack CLI in CI without a compilation
 * step, this mock implements the ZenStackClientInternal interface using the
 * `postgres` package directly.
 *
 * The adapter itself uses raw SQL for critical operations (getNextJob with
 * FOR UPDATE SKIP LOCKED), so this mock primarily serves the ORM-level
 * CRUD methods (create, findFirst, findMany, update, delete, etc.).
 */
export type MockZenStackClient = ReturnType<typeof createMockZenStackClient>

// ─── Utility functions ───────────────────────────────────────────────────────

function camelToSnake(str: string): string {
  return str.replaceAll(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

function snakeToCamel(str: string): string {
  return str.replaceAll(/_(?<letter>[a-z])/g, (_, letter: string) =>
    letter.toUpperCase()
  )
}

function transformRowToCamel(
  row: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    result[snakeToCamel(key)] = value
  }
  return result
}

function buildInPlaceholders(
  arr: unknown[],
  startIdx: number
): { placeholders: string; nextIdx: number } {
  const parts: string[] = []
  let idx = startIdx
  for (const _ of arr) {
    parts.push(`$${idx}`)
    idx++
  }
  return { placeholders: parts.join(", "), nextIdx: idx }
}

function buildScalarCondition(
  col: string,
  obj: Record<string, unknown>,
  conditions: string[],
  params: unknown[],
  idx: number
): number {
  let currentIdx = idx
  if ("in" in obj) {
    const arr = obj.in as unknown[]
    const { placeholders, nextIdx } = buildInPlaceholders(arr, currentIdx)
    conditions.push(`"${col}" IN (${placeholders})`)
    params.push(...arr)
    return nextIdx
  }
  if ("notIn" in obj) {
    const arr = obj.notIn as unknown[]
    const { placeholders, nextIdx } = buildInPlaceholders(arr, currentIdx)
    conditions.push(`"${col}" NOT IN (${placeholders})`)
    params.push(...arr)
    return nextIdx
  }
  if ("not" in obj) {
    if (obj.not === null) {
      conditions.push(`"${col}" IS NOT NULL`)
    } else {
      conditions.push(`"${col}" != $${currentIdx}`)
      params.push(obj.not)
      currentIdx++
    }
    return currentIdx
  }
  if ("contains" in obj) {
    conditions.push(`"${col}" LIKE $${currentIdx}`)
    params.push(`%${obj.contains}%`)
    return currentIdx + 1
  }
  if ("startsWith" in obj) {
    conditions.push(`"${col}" LIKE $${currentIdx}`)
    params.push(`${obj.startsWith}%`)
    return currentIdx + 1
  }
  return buildRangeConditions(col, obj, conditions, params, currentIdx)
}

function buildRangeConditions(
  col: string,
  obj: Record<string, unknown>,
  conditions: string[],
  params: unknown[],
  startIdx: number
): number {
  let currentIdx = startIdx
  if ("lt" in obj) {
    conditions.push(`"${col}" < $${currentIdx}`)
    params.push(obj.lt)
    currentIdx++
  }
  if ("lte" in obj) {
    conditions.push(`"${col}" <= $${currentIdx}`)
    params.push(obj.lte)
    currentIdx++
  }
  if ("gt" in obj) {
    conditions.push(`"${col}" > $${currentIdx}`)
    params.push(obj.gt)
    currentIdx++
  }
  if ("gte" in obj) {
    conditions.push(`"${col}" >= $${currentIdx}`)
    params.push(obj.gte)
    currentIdx++
  }
  return currentIdx
}

function buildWhereClause(
  where: Record<string, unknown>,
  startIdx = 1
): { clause: string; params: unknown[] } {
  const conditions: string[] = []
  const params: unknown[] = []
  let idx = startIdx

  for (const [key, value] of Object.entries(where)) {
    if (key === "AND" && Array.isArray(value)) {
      const andParts: string[] = []
      for (const sub of value) {
        const { clause: subClause, params: subParams } = buildWhereClause(
          sub as Record<string, unknown>,
          idx
        )
        andParts.push(`(${subClause})`)
        params.push(...subParams)
        idx += subParams.length
      }
      if (andParts.length > 0) {
        conditions.push(`(${andParts.join(" AND ")})`)
      }
    } else if (key === "OR" && Array.isArray(value)) {
      const orParts: string[] = []
      for (const sub of value) {
        const { clause: subClause, params: subParams } = buildWhereClause(
          sub as Record<string, unknown>,
          idx
        )
        orParts.push(`(${subClause})`)
        params.push(...subParams)
        idx += subParams.length
      }
      if (orParts.length > 0) {
        conditions.push(`(${orParts.join(" OR ")})`)
      }
    } else {
      const col = camelToSnake(key)
      if (value === null) {
        conditions.push(`"${col}" IS NULL`)
      } else if (typeof value === "object" && value !== null) {
        idx = buildScalarCondition(
          col,
          value as Record<string, unknown>,
          conditions,
          params,
          idx
        )
      } else {
        conditions.push(`"${col}" = $${idx}`)
        params.push(value)
        idx++
      }
    }
  }

  return {
    clause: conditions.length > 0 ? conditions.join(" AND ") : "1=1",
    params,
  }
}

// ─── Typed SQL helper ────────────────────────────────────────────────────────

async function query(
  sql: postgres.Sql,
  text: string,
  params: unknown[]
): Promise<any[]> {
  return sql.unsafe(text, params as any[])
}

// ─── Mock Client Factory ─────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function createMockZenStackClient(connectionUri: string) {
  const sql = postgres(connectionUri, { max: 10 })

  const createModelProxy = () =>
    new Proxy(
      {},
      {
        get(_target, prop: string) {
          if (prop === "create") {
            return async ({ data }: { data: Record<string, unknown> }) => {
              const id = (data.id as string) ?? crypto.randomUUID()
              const columns = Object.keys(data)
              const snakeColumns = columns.map((c) => camelToSnake(c))
              const values = columns.map((c) => data[c])

              const colStr = snakeColumns.map((c) => `"${c}"`).join(", ")
              const placeholders = values.map((_, i) => `$${i + 2}`).join(", ")

              const rows = await query(
                sql,
                `INSERT INTO queue_jobs ("id", ${colStr}) VALUES ($1, ${placeholders}) RETURNING *`,
                [id, ...values]
              )
              return transformRowToCamel(rows[0] as Record<string, unknown>)
            }
          }

          if (prop === "findFirst") {
            return async ({ where }: { where: Record<string, unknown> }) => {
              const { clause, params } = buildWhereClause(where)
              const rows = await query(
                sql,
                `SELECT * FROM queue_jobs WHERE ${clause} LIMIT 1`,
                params
              )
              return rows[0]
                ? transformRowToCamel(rows[0] as Record<string, unknown>)
                : null
            }
          }

          if (prop === "findMany") {
            return buildFindMany(sql)
          }

          if (prop === "update") {
            return buildUpdate(sql)
          }

          if (prop === "updateMany") {
            return buildUpdateMany(sql)
          }

          if (prop === "delete") {
            return async ({ where }: { where: Record<string, unknown> }) => {
              const { clause, params } = buildWhereClause(where)
              const rows = await query(
                sql,
                `DELETE FROM queue_jobs WHERE ${clause} RETURNING *`,
                params
              )
              if (rows.length === 0) {
                throw new Error("Record not found")
              }
              return transformRowToCamel(rows[0] as Record<string, unknown>)
            }
          }

          if (prop === "deleteMany") {
            return async ({ where }: { where: Record<string, unknown> }) => {
              const { clause, params } = buildWhereClause(where)
              const rows = await query(
                sql,
                `DELETE FROM queue_jobs WHERE ${clause}`,
                params
              )
              return { count: (rows as any).count ?? 0 }
            }
          }

          if (prop === "count") {
            return async ({ where }: { where: Record<string, unknown> }) => {
              const { clause, params } = buildWhereClause(where)
              const rows = await query(
                sql,
                `SELECT COUNT(*)::int as count FROM queue_jobs WHERE ${clause}`,
                params
              )
              return (rows[0] as any)?.count ?? 0
            }
          }

          if (prop === "groupBy") {
            return buildGroupBy(sql)
          }

          return null
        },
      }
    )

  return {
    queueJob: createModelProxy(),
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    $connect: async () => {},
    $disconnect: async () => {
      await sql.end()
    },
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>) =>
      sql.begin(async () => fn(null)),
    $queryRaw: async <T>(..._args: unknown[]) => [] as unknown as T,
    $queryRawUnsafe: async <T>(queryStr: string, ...values: unknown[]) => {
      const rows = await sql.unsafe(queryStr, values as any[])
      return rows as unknown as T
    },
    $executeRaw: async () => 0,
    $executeRawUnsafe: async (queryStr: string, ...values: unknown[]) => {
      const result = await sql.unsafe(queryStr, values as any[])
      return (result as any).count ?? 0
    },
  }
}

// ─── Extracted handler builders ──────────────────────────────────────────────

function buildFindMany(sql: postgres.Sql) {
  return async (args: {
    where?: Record<string, unknown>
    orderBy?: Record<string, string>
    take?: number
    skip?: number
    select?: Record<string, boolean>
  }) => {
    const { clause, params } = buildWhereClause(args.where ?? {})
    let queryStr = `SELECT * FROM queue_jobs WHERE ${clause}`
    if (args.orderBy) {
      const entries = Object.entries(args.orderBy)
      if (entries.length > 0) {
        const [field, dir] = entries[0] as [string, string]
        queryStr += ` ORDER BY "${camelToSnake(field)}" ${dir === "desc" ? "DESC" : "ASC"}`
      }
    }
    if (args.take !== undefined) {
      queryStr += ` LIMIT ${Number(args.take)}`
    }
    if (args.skip !== undefined) {
      queryStr += ` OFFSET ${Number(args.skip)}`
    }
    const rows = await query(sql, queryStr, params)
    if (args.select) {
      const selectKeys = Object.keys(args.select)
      return rows.map((r) => {
        const camel = transformRowToCamel(r as Record<string, unknown>)
        const result: Record<string, unknown> = {}
        for (const key of selectKeys) {
          result[key] = camel[key]
        }
        return result
      })
    }
    return rows.map((r) => transformRowToCamel(r as Record<string, unknown>))
  }
}

function buildUpdate(sql: postgres.Sql) {
  return async ({
    data,
    where,
  }: {
    data: Record<string, unknown>
    where: Record<string, unknown>
  }) => {
    const setClauses: string[] = []
    const setParams: unknown[] = []
    let paramIdx = 1

    for (const [key, value] of Object.entries(data)) {
      if (
        value !== null &&
        typeof value === "object" &&
        "increment" in (value as Record<string, unknown>)
      ) {
        const col = camelToSnake(key)
        setClauses.push(`"${col}" = "${col}" + $${paramIdx}`)
        setParams.push((value as { increment: number }).increment)
      } else {
        setClauses.push(`"${camelToSnake(key)}" = $${paramIdx}`)
        setParams.push(value)
      }
      paramIdx++
    }

    const { clause: whereClause, params: whereParams } = buildWhereClause(
      where,
      paramIdx
    )
    setParams.push(...whereParams)

    const rows = await query(
      sql,
      `UPDATE queue_jobs SET ${setClauses.join(", ")} WHERE ${whereClause} RETURNING *`,
      setParams
    )
    return rows[0]
      ? transformRowToCamel(rows[0] as Record<string, unknown>)
      : null
  }
}

function buildUpdateMany(sql: postgres.Sql) {
  return async ({
    data,
    where,
  }: {
    data: Record<string, unknown>
    where: Record<string, unknown>
  }) => {
    const setClauses: string[] = []
    const setParams: unknown[] = []
    let paramIdx = 1

    for (const [key, value] of Object.entries(data)) {
      setClauses.push(`"${camelToSnake(key)}" = $${paramIdx}`)
      setParams.push(value)
      paramIdx++
    }

    const { clause: whereClause, params: whereParams } = buildWhereClause(
      where,
      paramIdx
    )
    setParams.push(...whereParams)

    const rows = await query(
      sql,
      `UPDATE queue_jobs SET ${setClauses.join(", ")} WHERE ${whereClause}`,
      setParams
    )
    return { count: (rows as any).count ?? 0 }
  }
}

function buildGroupBy(sql: postgres.Sql) {
  return async ({
    by,
    where,
    _count,
  }: {
    by: string[]
    where: Record<string, unknown>
    _count: Record<string, boolean>
  }) => {
    const { clause, params } = buildWhereClause(where)
    const groupCols = by.map((b) => `"${camelToSnake(b)}"`).join(", ")
    const countField = Object.keys(_count)[0] ?? "id"
    const rows = await query(
      sql,
      `SELECT ${groupCols}, COUNT("${camelToSnake(countField)}")::int as count FROM queue_jobs WHERE ${clause} GROUP BY ${groupCols}`,
      params
    )
    return rows.map((r: any) => {
      const result: Record<string, unknown> = {}
      for (const b of by) {
        result[b] = r[camelToSnake(b)]
      }
      result._count = { [countField]: r.count }
      return result
    })
  }
}
