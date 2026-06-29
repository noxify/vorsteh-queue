import * as React from "react"

import { SidebarProvider } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

// Keep grid-specific desktop behavior isolated from the core shadcn sidebar.
// This allows replacing `sidebar.tsx` with upstream updates with minimal merge effort.
function SidebarGridProvider({
  className,
  style,
  sidebarMinWidth = "18rem",
  sidebarMaxWidth = "25vw",
  ...props
}: React.ComponentProps<typeof SidebarProvider> & {
  sidebarMinWidth?: string
  sidebarMaxWidth?: string
}) {
  return (
    <SidebarProvider
      className={cn(
        "relative md:grid md:grid-cols-[clamp(var(--sidebar-grid-min),var(--sidebar-grid-preferred,var(--sidebar-grid-min)),var(--sidebar-grid-max))_minmax(0,1fr)] md:[--sidebar-width:100%] has-data-[collapsible=offcanvas]:md:grid-cols-[0_minmax(0,1fr)]",
        "**:data-[slot=sidebar]:relative **:data-[slot=sidebar]:self-stretch",
        "**:data-[slot=sidebar-container]:sticky **:data-[slot=sidebar-container]:top-0 **:data-[slot=sidebar-container]:h-svh **:data-[slot=sidebar-container]:min-h-svh",
        className
      )}
      style={
        {
          "--sidebar-grid-max": sidebarMaxWidth,
          "--sidebar-grid-min": sidebarMinWidth,
          "--sidebar-width": "100%",
          ...style,
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { SidebarGridProvider }
