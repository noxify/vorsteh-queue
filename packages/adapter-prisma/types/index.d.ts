/**
 * Generic Prisma client interface - accepts a PrismaClient
 * Inspired by better-auth's approach: https://github.com/better-auth/better-auth/blob/main/packages/better-auth/src/adapters/prisma-adapter/prisma-adapter.ts
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Prisma } from "~/generated/prisma/client"

// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface
export interface PrismaClient {}

/**
 * Internal Prisma client interface with dynamic model access
 * This allows us to work with any Prisma client without importing specific types
 */
export type PrismaClientInternal = Record<
  string,
  {
    create: (data: any) => Promise<any>
    findFirst: (data: any) => Promise<any>
    findMany: (data: any) => Promise<any>
    update: (data: any) => Promise<any>
    delete: (data: any) => Promise<any>
    deleteMany: (data: any) => Promise<{ count: number }>
    count: (data: any) => Promise<number>
    groupBy: (data: any) => Promise<any>
    [key: string]: any
  }
> & {
  $connect: () => Promise<void>
  $disconnect: () => Promise<void>
  $transaction: <T>(
    callback: (tx: any) => Promise<T>,
    options?: any
  ) => Promise<T>
  $queryRaw: <T = unknown>(
    query: TemplateStringsArray | Prisma.Sql,
    ...values: any[]
  ) => Promise<T>
  $queryRawUnsafe: <T = unknown>(query: string, ...values: any[]) => Promise<T>
  $executeRaw: (
    query: TemplateStringsArray | Prisma.Sql,
    ...values: any[]
  ) => Promise<number>
}
