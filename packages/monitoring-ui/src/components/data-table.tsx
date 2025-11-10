"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { AvailableStatus } from "@/types"
import { statusColorMap } from "@/utils/colors"
import {
  Column,
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  Row,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table"
import { intlFormatDistance } from "date-fns"
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  Columns2Icon,
  MoreVerticalIcon,
} from "lucide-react"

import type { BaseJob } from "@vorsteh-queue/core"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion"
import { Label } from "./ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip"

export function DataTable({ data }: { data: BaseJob<unknown, unknown>[] }) {
  const [currentTab, setCurrentTab] = React.useState("all")
  const [openJobId, setOpenJobId] = React.useState<string | null>(null)

  const columns: ColumnDef<BaseJob>[] = [
    {
      accessorKey: "id",
      header: "ID",
      meta: {
        name: "ID",
      },
      cell: ({ row }) => (
        <TableCellViewer
          item={row.original}
          open={openJobId === row.original.id}
          setOpen={(open) => setOpenJobId(open ? row.original.id : null)}
        />
      ),
      enableHiding: false,
    },
    {
      accessorKey: "name",
      header: "Name",
      meta: {
        name: "Name",
      },
      cell: ({ row }) => <>{row.original.status}</>,
    },
    {
      accessorKey: "status",
      header: "Status",
      meta: {
        name: "Status",
      },
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={cn(
            statusColorMap[row.original.status as AvailableStatus].text,
            statusColorMap[row.original.status as AvailableStatus].bg,
          )}
        >
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "progress",
      header: "Progress",
      meta: {
        name: "Progress",
      },
      cell: ({ row }) => <>{row.original.progress} %</>,
    },
    {
      accessorKey: "attempts",
      header: "Attempts",
      meta: {
        name: "Attempts",
      },
      cell: ({ row }) => (
        <>
          {row.original.attempts} / {row.original.maxAttempts}
        </>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Created at",
      meta: {
        name: "Created at",
      },
      cell: ({ row, cell }) => (
        <>{row.original.createdAt ? <DateTooltip date={row.original.createdAt} /> : ""}</>
      ),
    },
    {
      accessorKey: "processAt",
      header: "Process at",
      meta: {
        name: "Process at",
      },
      cell: ({ row, cell }) => (
        <>{row.original.processAt ? <DateTooltip date={row.original.processAt} /> : ""}</>
      ),
    },
    {
      accessorKey: "processedAt",
      header: "Processed at",
      meta: {
        name: "Processed at",
      },
      cell: ({ row, cell }) => (
        <>{row.original.processedAt ? <DateTooltip date={row.original.processedAt} /> : ""}</>
      ),
    },
    {
      accessorKey: "failedAt",
      header: "Failed at",
      meta: {
        name: "Failed at",
      },
      cell: ({ row, cell }) => (
        <>{row.original.failedAt ? <DateTooltip date={row.original.failedAt} /> : ""}</>
      ),
    },
    {
      accessorKey: "completedAt",
      header: "Completed at",
      meta: {
        name: "Completed at",
      },
      cell: ({ row, cell }) => (
        <>{row.original.completedAt ? <DateTooltip date={row.original.completedAt} /> : ""}</>
      ),
    },
    {
      id: "actions",
      meta: {
        headerClassName: "w-[40px] bg-muted",
        cellClassName: "bg-background",
      },
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex size-8 text-muted-foreground data-[state=open]:bg-muted"
              size="icon"
            >
              <MoreVerticalIcon />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32">
            <TableCellViewer
              item={row.original}
              modal={false}
              open={openJobId === row.original.id}
              setOpen={(open) => setOpenJobId(open ? row.original.id : null)}
            >
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  setOpenJobId(row.original.id)
                }}
              >
                Details
              </DropdownMenuItem>
            </TableCellViewer>
            <DropdownMenuItem>Make a copy</DropdownMenuItem>
            <DropdownMenuItem>Favorite</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({
    progress: false,
    processAt: false,
    failedAt: false,
    completedAt: false,
  })
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  })

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      columnFilters,
      pagination,
    },
    initialState: {
      columnPinning: { right: ["actions"] },
      sorting: [{ id: "createdAt", desc: true }],
    },
    getRowId: (row) => row.id.toString(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  const handleTabChange = (tab: string) => {
    setCurrentTab(tab)
    if (tab === "all") {
      table.getColumn("status")?.setFilterValue(undefined)
    } else {
      table.getColumn("status")?.setFilterValue(tab)
    }
  }

  return (
    <>
      <Tabs
        defaultValue={currentTab}
        onValueChange={handleTabChange}
        className="w-full flex-col justify-start gap-6"
      >
        <div className="flex items-center justify-between">
          <Label htmlFor="view-selector" className="sr-only">
            Queue filter
          </Label>
          <Select defaultValue={currentTab} value={currentTab} onValueChange={handleTabChange}>
            <SelectTrigger className="flex w-fit lg:hidden" size="sm" id="view-selector">
              <SelectValue placeholder="Filter queue" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="delayed">Delayed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <TabsList className="hidden **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:bg-muted-foreground/30 **:data-[slot=badge]:px-1 lg:flex">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="processing">Processing</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="failed">Failed</TabsTrigger>
            <TabsTrigger value="delayed">Delayed</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Columns2Icon />
                  <span className="lg:hidden">Columns</span>
                  <ChevronDownIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {table
                  .getAllColumns()
                  .filter(
                    (column) => typeof column.accessorFn !== "undefined" && column.getCanHide(),
                  )
                  .map((column) => {
                    return (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) => column.toggleVisibility(!!value)}
                      >
                        {column.columnDef.meta?.name ?? column.id}
                      </DropdownMenuCheckboxItem>
                    )
                  })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </Tabs>
      <div className="w-full overflow-auto">
        <div className="overflow-hidden rounded-md border">
          <Table className="table-auto">
            <TableHeader className="sticky top-0 z-10 bg-muted">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead
                        key={header.id}
                        colSpan={header.colSpan}
                        style={{
                          ...getCommonPinningStyles({ column: header.column }),
                        }}
                        className={header.column.columnDef.meta?.headerClassName}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody className="**:data-[slot=table-cell]:first:w-8">
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row: Row<BaseJob>) => (
                  <TableRow className="relative z-0" key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        style={{
                          ...getCommonPinningStyles({ column: cell.column }),
                        }}
                        className={cell.column.columnDef.meta?.cellClassName}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="hidden flex-1 text-sm text-muted-foreground lg:flex"></div>
        <div className="flex w-full items-center gap-8 lg:w-fit">
          <div className="hidden items-center gap-2 lg:flex">
            <Label htmlFor="rows-per-page" className="text-sm font-medium">
              Rows per page
            </Label>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(value) => {
                table.setPageSize(Number(value))
              }}
            >
              <SelectTrigger size="sm" className="w-20" id="rows-per-page">
                <SelectValue placeholder={table.getState().pagination.pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 40, 50].map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-fit items-center justify-center text-sm font-medium">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </div>
          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Go to first page</span>
              <ChevronsLeftIcon />
            </Button>
            <Button
              variant="outline"
              className="size-8"
              size="icon"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Go to previous page</span>
              <ChevronLeftIcon />
            </Button>
            <Button
              variant="outline"
              className="size-8"
              size="icon"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Go to next page</span>
              <ChevronRightIcon />
            </Button>
            <Button
              variant="outline"
              className="hidden size-8 lg:flex"
              size="icon"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Go to last page</span>
              <ChevronsRightIcon />
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}

function DateTooltip({ date }: { date: Date | null }) {
  if (!date) {
    return <></>
  }

  return (
    <Tooltip>
      <TooltipTrigger>{intlFormatDistance(date, new Date(), { locale: "en" })}</TooltipTrigger>
      <TooltipContent>{date ? date.toLocaleString() : "No date available"}</TooltipContent>
    </Tooltip>
  )
}

function getCommonPinningStyles<TData>({ column }: { column: Column<TData> }): React.CSSProperties {
  const isPinned = column.getIsPinned()

  const isLastLeftPinnedColumn = isPinned === "left" && column.getIsLastColumn("left")
  const isFirstRightPinnedColumn = isPinned === "right" && column.getIsFirstColumn("right")

  return {
    boxShadow: isLastLeftPinnedColumn
      ? "-3px 0 4px -5px var(--foreground) inset"
      : isFirstRightPinnedColumn
        ? "3px 0 4px -5px var(--foreground) inset"
        : undefined,
    left: isPinned === "left" ? `${column.getStart("left")}px` : undefined,
    right: isPinned === "right" ? `${column.getAfter("right")}px` : undefined,
    opacity: isPinned ? 0.97 : 1,
    position: isPinned ? "sticky" : "relative",
    background: isPinned ? "bg-white" : undefined,
    zIndex: isPinned ? 1 : 0,
  }
}

function TableCellViewer({
  item,
  triggerLabel,
  children,
  modal = true,
  open,
  setOpen,
}: {
  item: BaseJob
  triggerLabel?: string
  children?: React.ReactNode
  modal?: boolean
  open?: boolean
  setOpen?: (open: boolean) => void
}) {
  const details = [
    { value: item.id, label: "ID" },
    { value: item.name, label: "Name" },
    { value: item.status, label: "Status" },
    { value: item.priority, label: "Priority" },
    { value: item.attempts, label: "Attempts" },
    { value: item.maxAttempts, label: "Max Attempts" },
    { value: item.createdAt, label: "Created At" },
    { value: item.processAt, label: "Process At" },
    { value: item.processedAt, label: "Processed At" },
    { value: item.completedAt, label: "Completed At" },
    { value: item.failedAt, label: "Failed At" },
    { value: item.progress, label: "Progress" },
    { value: item.cron, label: "Cron" },
    { value: item.repeatEvery, label: "Repeat Every" },
    { value: item.repeatLimit, label: "Repeat Limit" },
    { value: item.repeatCount, label: "Repeat Count" },
    { value: item.timeout, label: "Timeout" },
  ]

  return (
    <Sheet modal={modal} open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {children ? (
          children
        ) : (
          <Button variant="link" className="w-fit px-0 text-left text-foreground">
            {triggerLabel ?? item.id}
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="md:w-[500px]! md:max-w-full!">
        <SheetHeader className="gap-1">
          <SheetTitle>Job details</SheetTitle>
          <SheetDescription>Showing the job details</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          <Accordion type="multiple" defaultValue={["details"]} className="px-4">
            <AccordionItem value="details">
              <AccordionTrigger>Job Details</AccordionTrigger>
              <AccordionContent>
                <dl className="divide-y divide-accent">
                  {details.map((item) => (
                    <div key={item.label} className="grid grid-cols-2 gap-4 py-2">
                      <dt className="text-sm/6 font-medium">{item.label}</dt>
                      <dd className="mt-0 text-right font-mono text-sm/6">
                        {item.value instanceof Date
                          ? item.value.toLocaleString()
                          : String(item.value ?? "")}
                      </dd>
                    </div>
                  ))}
                </dl>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="payload">
              <AccordionTrigger>Payload</AccordionTrigger>
              <AccordionContent>
                <pre className="max-h-96 overflow-auto rounded-md bg-muted p-4 text-sm">
                  {JSON.stringify(item.payload, null, 2)}
                </pre>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="error">
              <AccordionTrigger>Error</AccordionTrigger>
              <AccordionContent>
                <pre className="max-h-96 overflow-auto rounded-md bg-muted p-4 text-sm">
                  {item.error ? JSON.stringify(item.error, null, 2) : "No error available"}
                </pre>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="result">
              <AccordionTrigger>Result</AccordionTrigger>
              <AccordionContent>
                <pre className="max-h-96 overflow-auto rounded-md bg-muted p-4 text-sm">
                  {item.result ? JSON.stringify(item.result, null, 2) : "No result available"}
                </pre>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </SheetContent>
    </Sheet>
  )
}
