import React from "react"
import { cn } from "@/lib/utils"

const Container = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, className }, ref) => (
    <div className="@container/main container gap-6" ref={ref}>
      <div className={cn("pt-6 pb-8", className)}>{children}</div>
    </div>
  ),
)
Container.displayName = "Container"

export { Container }
