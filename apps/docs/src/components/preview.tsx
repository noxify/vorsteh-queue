import type { ReactNode } from "react"

export function Preview({ children }: { children: ReactNode }) {
  return (
    <section>
      <div>
        <div className="dot-background rounded-md rounded-b-none border border-b-0 p-8 dark:border-gray-700">
          <div className="bg-background border p-4">{children}</div>
        </div>
      </div>
    </section>
  )
}
