/**
 * Generic Prisma client interface - accepts a PrismaClient
 * Inspired by better-auth's approach: https://github.com/better-auth/better-auth/blob/main/packages/better-auth/src/adapters/prisma-adapter/prisma-adapter.ts
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface PrismaClient {}

/**
 * Internal Prisma client interface with dynamic model access
 * This allows us to work with any Prisma client without importing specific types
 */
export type PrismaClientInternal = Record<
  string,
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: (data: any) => Promise<any>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findFirst: (data: any) => Promise<any>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findMany: (data: any) => Promise<any>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: (data: any) => Promise<any>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete: (data: any) => Promise<any>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deleteMany: (data: any) => Promise<{ count: number }>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    count: (data: any) => Promise<number>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    groupBy: (data: any) => Promise<any>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any
  }
> & {
  $connect: () => Promise<void>
  $disconnect: () => Promise<void>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $transaction: <T>(callback: (tx: any) => Promise<T>, options?: any) => Promise<T>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $queryRaw: <T = unknown>(query: TemplateStringsArray, ...values: any[]) => Promise<T>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $executeRaw: (query: TemplateStringsArray, ...values: any[]) => Promise<number>
}
