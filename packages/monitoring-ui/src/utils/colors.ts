import type { AvailableStatus } from "@/types"

export const statusColorMap: Record<
  AvailableStatus,
  {
    bg: string
    text: string
    borderL: string
    borderR: string
    borderT: string
    borderB: string
  }
> = {
  pending: {
    bg: "bg-yellow-500/80 dark:bg-yellow-300/80",
    text: "text-gray-900 dark:text-gray-900",
    borderL: "border-l-yellow-500 dark:border-l-yellow-300",
    borderR: "border-r-yellow-500 dark:border-r-yellow-300",
    borderT: "border-t-yellow-500 dark:border-t-yellow-300",
    borderB: "border-b-yellow-500 dark:border-b-yellow-300",
  },
  processing: {
    bg: "bg-blue-500/80 dark:bg-blue-300/80",
    text: "text-gray-900 dark:text-gray-900",
    borderL: "border-l-blue-500 dark:border-l-blue-300",
    borderR: "border-r-blue-500 dark:border-r-blue-300",
    borderT: "border-t-blue-500 dark:border-t-blue-300",
    borderB: "border-b-blue-500 dark:border-b-blue-300",
  },
  completed: {
    bg: "bg-green-500/80 dark:bg-green-300/80",
    text: "text-gray-900 dark:text-gray-900",
    borderL: "border-l-green-500 dark:border-l-green-300",
    borderR: "border-r-green-500 dark:border-r-green-300",
    borderT: "border-t-green-500 dark:border-t-green-300",
    borderB: "border-b-green-500 dark:border-b-green-300",
  },
  failed: {
    bg: "bg-red-600/90 dark:bg-red-400/90",
    text: "text-gray-50 dark:text-gray-900",
    borderL: "border-l-red-600 dark:border-l-red-400",
    borderR: "border-r-red-600 dark:border-r-red-400",
    borderT: "border-t-red-600 dark:border-t-red-400",
    borderB: "border-b-red-600 dark:border-b-red-400",
  },
  delayed: {
    bg: "bg-orange-500/80 dark:bg-orange-300/80",
    text: "text-gray-900 dark:text-gray-900",
    borderL: "border-l-orange-500 dark:border-l-orange-300",
    borderR: "border-r-orange-500 dark:border-r-orange-300",
    borderT: "border-t-orange-500 dark:border-t-orange-300",
    borderB: "border-b-orange-500 dark:border-b-orange-300",
  },
  cancelled: {
    bg: "bg-gray-500/80 dark:bg-gray-300/80",
    text: "text-gray-50 dark:text-gray-900",
    borderL: "border-l-gray-500 dark:border-l-gray-300",
    borderR: "border-r-gray-500 dark:border-r-gray-300",
    borderT: "border-t-gray-500 dark:border-t-gray-300",
    borderB: "border-b-gray-500 dark:border-b-gray-300",
  },
}
