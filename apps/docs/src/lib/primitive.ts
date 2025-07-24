"use client"

import type { ClassNameValue } from "tailwind-merge"
import { composeRenderProps } from "react-aria-components"
import { twMerge } from "tailwind-merge"

function composeTailwindRenderProps<T>(
  className: string | ((v: T) => string) | undefined,
  tailwind: ClassNameValue,
): string | ((v: T) => string) {
  return composeRenderProps(className, (className) => twMerge(tailwind, className))
}

export { composeTailwindRenderProps }
