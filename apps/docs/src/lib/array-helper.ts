export function removeFromArray<T>(array: T[], valueToRemove: T[]): T[] {
  return array.filter((value) => !valueToRemove.includes(value))
}

export async function asyncFilter<T>(
  arr: T[],
  predicate: (el: T) => Promise<boolean>
): Promise<T[]> {
  const filtered: T[] = []

  for (const element of arr) {
    // oxlint-disable-next-line no-await-in-loop
    if (await predicate(element)) {
      filtered.push(element)
    }
  }

  return filtered
}

export const hasAnyMatch = <T>(target: T[], source: T[]) =>
  target.some((item) => source.includes(item))

export const hasExactMatch = <T>(target: T[], source: T[]) =>
  target.length === source.length &&
  target.every((item) => source.includes(item))
