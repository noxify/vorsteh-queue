/**
 * Suspense-compatible resource factory.
 *
 * Creates a resource that can be read synchronously inside a React component.
 * On first read, throws a promise (triggers Suspense fallback).
 * On subsequent reads after resolution, returns the cached value.
 */

type ResourceStatus = "pending" | "resolved" | "rejected"

interface Resource<TData> {
  /** Read the resource value (throws promise if pending, throws error if rejected) */
  read: () => TData
  /** Invalidate the cache, forcing a re-fetch on next read */
  invalidate: () => void
}

/**
 * Create a Suspense-compatible resource from an async function.
 *
 * @param fetcher - Async function that produces the data
 * @returns Resource with read() and invalidate() methods
 */
export function createResource<TData>(
  fetcher: () => Promise<TData>
): Resource<TData> {
  let status: ResourceStatus = "pending"
  let result: TData
  let rejection: unknown
  let promise: Promise<void> | undefined

  const load = (): Promise<void> => {
    if (!promise) {
      status = "pending"
      promise = fetcher().then(
        (data) => {
          status = "resolved"
          result = data
        },
        (error: unknown) => {
          status = "rejected"
          rejection = error
        }
      )
    }
    return promise
  }

  void load()

  return {
    read(): TData {
      if (status === "pending") {
        // oxlint-disable-next-line no-throw-literal -- Suspense requires throwing a thenable
        throw load() as unknown
      }
      if (status === "rejected") {
        throw rejection instanceof Error
          ? rejection
          : new Error(String(rejection))
      }
      return result
    },
    invalidate() {
      promise = undefined
      status = "pending"
      void load()
    },
  }
}
