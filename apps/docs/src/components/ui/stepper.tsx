import type { PropsWithChildren } from "react"
import { Children } from "react"
import clsx from "clsx"

import { cn } from "~/lib/utils"

export function Stepper({ children }: PropsWithChildren) {
  const length = Children.count(children)

  return (
    <div className="flex flex-col">
      {Children.map(children, (child, index) => {
        return (
          <div
            className={cn(
              "relative border-l border-gray-200 pl-9 dark:border-gray-700",
              clsx({
                "pb-5": index < length - 1,
              }),
            )}
          >
            <div className="font-code absolute -left-4 flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-medium dark:bg-gray-700">
              {index + 1}
            </div>
            {child}
          </div>
        )
      })}
    </div>
  )
}

export function StepperItem({ children, title }: PropsWithChildren & { title?: string }) {
  return (
    <div className="pt-0.5">
      <h4 className="mt-0">{title}</h4>
      <div>{children}</div>
    </div>
  )
}
