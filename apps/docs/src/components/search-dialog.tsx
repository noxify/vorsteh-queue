"use client"

import * as React from "react"
import { Search } from "lucide-react"

import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"

export function SearchDialog() {
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 px-0">
          <Search className="text-dark-200 dark:text-dark-900 h-5 w-5" />
          <span className="sr-only">Search documentation</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-cream-50 dark:bg-dark-100 text-dark-200 dark:text-dark-900 sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Search Documentation</DialogTitle>
          <DialogDescription>
            Type your query to find relevant information in the Vorsteh Queue docs.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="search" className="sr-only">
              Search
            </Label>
            <Input
              id="search"
              placeholder="Search..."
              className="bg-cream-100 dark:bg-dark-200 border-cream-200 dark:border-dark-50 text-dark-200 dark:text-dark-900 col-span-4"
            />
          </div>
        </div>
        {/* You would typically add search results here */}
        <div className="text-fur-500 dark:text-dark-800 text-sm">
          <p>
            Press{" "}
            <kbd className="bg-muted text-muted-foreground pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium opacity-100">
              <span className="text-xs">⌘</span>K
            </kbd>{" "}
            or{" "}
            <kbd className="bg-muted text-muted-foreground pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium opacity-100">
              <span className="text-xs">Ctrl</span>K
            </kbd>{" "}
            to open search.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
