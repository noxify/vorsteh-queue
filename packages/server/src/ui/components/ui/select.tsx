import { Select as BaseSelect } from "@base-ui/react/select"
import { CheckIcon, ChevronDownIcon } from "lucide-react"
import { forwardRef } from "react"

import { cn } from "~/lib/utils"

const Select = BaseSelect.Root

const SelectTrigger = forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof BaseSelect.Trigger>
>(({ className, children, ...props }, ref) => (
  <BaseSelect.Trigger
    ref={ref}
    className={cn(
      "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
      className
    )}
    {...props}
  >
    {children}
    <BaseSelect.Icon>
      <ChevronDownIcon className="h-4 w-4 opacity-50" />
    </BaseSelect.Icon>
  </BaseSelect.Trigger>
))
SelectTrigger.displayName = "SelectTrigger"

const SelectValue = BaseSelect.Value

const SelectPortal = BaseSelect.Portal

const SelectPositioner = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof BaseSelect.Positioner>
>(({ className, children, ...props }, ref) => (
  <SelectPortal>
    <BaseSelect.Positioner
      ref={ref}
      className={cn("z-50", className)}
      {...props}
    >
      <BaseSelect.Popup className="border-border bg-popover text-popover-foreground relative max-h-96 min-w-[8rem] overflow-hidden rounded-md border shadow-md data-[ending-style]:opacity-0 data-[starting-style]:opacity-0">
        {children}
      </BaseSelect.Popup>
    </BaseSelect.Positioner>
  </SelectPortal>
))
SelectPositioner.displayName = "SelectPositioner"

const SelectItem = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof BaseSelect.Item>
>(({ className, children, ...props }, ref) => (
  <BaseSelect.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <BaseSelect.ItemIndicator className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
      <CheckIcon className="h-4 w-4" />
    </BaseSelect.ItemIndicator>
    <BaseSelect.ItemText>{children}</BaseSelect.ItemText>
  </BaseSelect.Item>
))
SelectItem.displayName = "SelectItem"

export { Select, SelectItem, SelectPositioner, SelectTrigger, SelectValue }
