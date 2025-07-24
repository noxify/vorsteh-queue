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
