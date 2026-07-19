/**
 * Generic ZenStack client interface - accepts a ZenStackClient.
 *
 * ZenStack v3 provides a Prisma-compatible query API built on Kysely.
 * This interface abstracts the client for use within the adapter without
 * requiring the user's generated types.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface
export interface ZenStackClient {}

/**
 * Internal ZenStack client interface with dynamic model access.
 *
 * This allows us to work with any ZenStack client without importing
 * specific generated types. The API mirrors PrismaClient since ZenStack v3
 * provides a Prisma-compatible interface.
 */
export type ZenStackClientInternal = Record<
  string,
  {
    create: (data: any) => Promise<any>
    findFirst: (data: any) => Promise<any>
    findMany: (data: any) => Promise<any>
    findUnique: (data: any) => Promise<any>
    update: (data: any) => Promise<any>
    updateMany: (data: any) => Promise<any>
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
    callbackOrOperations: ((tx: any) => Promise<T>) | any[],
    options?: any
  ) => Promise<T>
  $queryRaw: <T = unknown>(
    query: TemplateStringsArray,
    ...values: any[]
  ) => Promise<T>
  $queryRawUnsafe: <T = unknown>(query: string, ...values: any[]) => Promise<T>
  $executeRaw: (
    query: TemplateStringsArray,
    ...values: any[]
  ) => Promise<number>
  $executeRawUnsafe: (query: string, ...values: any[]) => Promise<number>
}
