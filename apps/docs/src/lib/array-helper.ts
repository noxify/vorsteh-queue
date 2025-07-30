export async function asyncFilter<T>(arr: T[], cb: (el: T) => Promise<boolean>): Promise<T[]> {
  const filtered: T[] = []

  for (const element of arr) {
    const needAdd = await cb(element)

    if (needAdd) {
      filtered.push(element)
    }
  }

  return filtered
}

export const hasAnyMatch = <T>(target: T[], source: T[]) =>
  target.some((item) => source.includes(item))

export const hasExactMatch = <T>(target: T[], source: T[]) =>
  target.length === source.length && target.every((item) => source.includes(item))
