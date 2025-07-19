import type { ClassValue } from "clsx"
import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Create a slug from a string. */
// source: https://github.com/souporserious/renoun/blob/main/packages/renoun/src/utils/create-slug.ts
export function createSlug(input: string) {
  return input
    .replace(/([a-z])([A-Z])/g, "$1-$2") // Add a hyphen between lower and upper case letters
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2") // Add a hyphen between consecutive upper case letters followed by a lower case letter
    .replace(/[_\s]+/g, "-") // Replace underscores and spaces with a hyphen
    .toLowerCase() // Convert the entire string to lowercase
}

export function removeFromArray<T>(array: T[], valueToRemove: T[]): T[] {
  return array.filter((value) => !valueToRemove.includes(value))
}
