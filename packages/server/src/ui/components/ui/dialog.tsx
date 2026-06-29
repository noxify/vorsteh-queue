import { Dialog as BaseDialog } from "@base-ui/react/dialog"
import { X } from "lucide-react"
import { forwardRef } from "react"

import { cn } from "~/lib/utils"

const Dialog = BaseDialog.Root

const DialogTrigger = BaseDialog.Trigger

const DialogClose = BaseDialog.Close

const DialogPortal = BaseDialog.Portal

const DialogBackdrop = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof BaseDialog.Backdrop>
>(({ className, ...props }, ref) => (
  <BaseDialog.Backdrop
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity",
      className
    )}
    {...props}
  />
))
DialogBackdrop.displayName = "DialogBackdrop"

const DialogPopup = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof BaseDialog.Popup>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogBackdrop />
    <BaseDialog.Popup
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border border-border bg-background p-6 shadow-lg duration-200 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 sm:rounded-lg",
        className
      )}
      {...props}
    >
      {children}
      <DialogClose className="ring-offset-background focus:ring-ring absolute top-4 right-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:pointer-events-none">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogClose>
    </BaseDialog.Popup>
  </DialogPortal>
))
DialogPopup.displayName = "DialogPopup"

const DialogTitle = forwardRef<
  HTMLHeadingElement,
  React.ComponentPropsWithoutRef<typeof BaseDialog.Title>
>(({ className, ...props }, ref) => (
  <BaseDialog.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = "DialogTitle"

const DialogDescription = forwardRef<
  HTMLParagraphElement,
  React.ComponentPropsWithoutRef<typeof BaseDialog.Description>
>(({ className, ...props }, ref) => (
  <BaseDialog.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = "DialogDescription"

export {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
