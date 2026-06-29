/**
 * Promise cache helper inspired by Fumadocs:
 * https://www.fumadocs.dev/docs/markdown/mermaid
 */
export function cachePromise<T>(
  cache: Map<string, Promise<T>>,
  key: string,
  setPromise: () => Promise<T>
): Promise<T> {
  const cached = cache.get(key)

  if (cached) {
    return cached
  }

  const promise = setPromise()
  cache.set(key, promise)

  return promise
}
