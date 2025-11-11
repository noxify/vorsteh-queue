import { cn } from "@/lib/utils"

export function StatCard({
  title,
  value,
  className,
}: {
  title: string
  value: string | number
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex w-full items-center justify-between rounded border bg-accent p-4 md:block",
        className,
      )}
    >
      <p className="order-last font-semibold">{value}</p>
      <p className="order-first whitespace-nowrap">{title}</p>
    </div>
  )
}
