/**
 * ZenStack query builder for vorsteh-queue.
 *
 * Since ZenStack v3 provides a Prisma-compatible query API, the where
 * clause format is identical to Prisma. This module re-exports the
 * Prisma `buildWhere` for use with ZenStack ORM clients.
 *
 * @example
 * ```typescript
 * import { buildWhere } from "@vorsteh-queue/query-builder/zenstack"
 * import { normalizeWhere } from "@vorsteh-queue/query-builder"
 *
 * const normalized = normalizeWhere({ status: "pending", name: { contains: "email" } })
 * const where = buildWhere(normalized)
 * const jobs = await db.queueJob.findMany({ where })
 * ```
 */
export { buildWhere } from "./prisma"
