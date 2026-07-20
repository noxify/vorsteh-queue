/**
 * Stub for type-checking purposes.
 *
 * At install time, the user's own shadcn utils (cn) is used instead.
 */

import type { ClassValue } from "clsx"
import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: readonly ClassValue[]): string {
  return twMerge(clsx(inputs))
}
