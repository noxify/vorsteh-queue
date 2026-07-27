"use client"

import type { QueueStats } from "@vorsteh-queue/core"
import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface QueueData {
  name: string
  stats: QueueStats
}

export function DashboardView({ queues }: { queues: QueueData[] }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of all queues</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {queues
                .reduce((sum, q) => sum + q.stats.pending, 0)
                .toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Total Processing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {queues
                .reduce((sum, q) => sum + q.stats.processing, 0)
                .toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-destructive text-2xl font-bold">
              {queues
                .reduce((sum, q) => sum + q.stats.failed, 0)
                .toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Dead</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-destructive text-2xl font-bold">
              {queues
                .reduce((sum, q) => sum + q.stats.dead, 0)
                .toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Queues</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Queue</TableHead>
                <TableHead className="text-right">Pending</TableHead>
                <TableHead className="text-right">Processing</TableHead>
                <TableHead className="text-right">Completed</TableHead>
                <TableHead className="text-right">Failed</TableHead>
                <TableHead className="text-right">Dead</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queues.map((queue) => (
                <TableRow key={queue.name}>
                  <TableCell>
                    <Link
                      href={`/${queue.name}`}
                      className="text-primary font-medium hover:underline"
                    >
                      {queue.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">
                    {queue.stats.pending.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {queue.stats.processing.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {queue.stats.completed.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {queue.stats.failed.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {queue.stats.dead.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
