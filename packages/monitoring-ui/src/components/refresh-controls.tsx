"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { ChevronDownIcon, Pause, Play, RotateCw } from "lucide-react"

import { ButtonGroup } from "./ui/button-group"

export function RefreshControls({
  refreshInterval,
  setRefreshInterval,
  isPaused,
  setIsPaused,
  lastUpdatedAt,
  isFetching,
  onManualRefresh,
}: {
  refreshInterval: number
  setRefreshInterval: (interval: number) => void
  isPaused: boolean
  setIsPaused: (paused: boolean) => void
  lastUpdatedAt?: number // Max Timestamp über relevante Queries
  isFetching?: boolean // Aggregierter Fetch-Status
  onManualRefresh?: () => void // Manueller Refresh Trigger
}) {
  // Countdown basiert direkt auf lastUpdatedAt.
  const [cycleStart, setCycleStart] = useState<number>(lastUpdatedAt ?? 0)
  const [now, setNow] = useState<number>(Date.now())

  // Wenn sich der externe Timestamp ändert -> neuen Zyklus beginnen
  useEffect(() => {
    if (!isPaused && lastUpdatedAt && lastUpdatedAt !== cycleStart) {
      setCycleStart(lastUpdatedAt)
      setNow(Date.now())
    }
  }, [lastUpdatedAt, isPaused, cycleStart])

  // Sekundentakt für Countdown
  useEffect(() => {
    if (isPaused) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [isPaused])

  const hasValidStart = cycleStart > 0
  const timeLeftMs = hasValidStart ? cycleStart + refreshInterval - now : refreshInterval

  const formatTimeLeft = (diffMs: number) => {
    // Kleine negative Werte (Timing Drift) behandeln als volles Intervall-Neustart bereits erfolgt
    if (diffMs <= 0) return "now"
    const seconds = Math.floor(diffMs / 1000)
    if (seconds < 60) return `${seconds}s`
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  }

  const refreshOptions = [
    { label: "5 seconds", value: 5000 },
    { label: "10 seconds", value: 10000 },
    { label: "15 seconds", value: 15000 },
    { label: "30 seconds", value: 30000 },
    { label: "1 minute", value: 60000 },
    { label: "5 minutes", value: 300000 },
  ]

  const handleRefreshChange = (interval: number) => {
    setRefreshInterval(interval)
  }

  const toggleAutoRefresh = () => {
    const newPausedState = !isPaused
    setIsPaused(newPausedState)
    if (!newPausedState) setNow(Date.now())
  }

  return (
    <>
      <ButtonGroup>
        {onManualRefresh && (
          <Button
            onClick={() => onManualRefresh()}
            variant="outline"
            disabled={isFetching}
            className="relative cursor-pointer"
          >
            {isFetching ? <Spinner className="h-4 w-4" /> : <RotateCw className="h-4 w-4" />}
          </Button>
        )}
        <Button
          onClick={toggleAutoRefresh}
          variant="outline"
          className={cn(
            {
              "text-emerald-400 hover:text-foreground": !isPaused,
              "text-red-400 hover:text-foreground": isPaused,
            },
            "cursor-pointer",
          )}
        >
          {!isPaused ? (
            <>
              <Pause className="h-4 w-4" />
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
            </>
          )}
        </Button>

        <Button variant="outline" className="w-28">
          <div
            className={`h-2 w-2 rounded-full ${
              !isPaused ? "animate-pulse bg-emerald-500" : "bg-red-500"
            }`}
          />
          {!isPaused ? (
            <span className="flex items-center gap-1 font-mono font-semibold text-foreground">
              {hasValidStart ? formatTimeLeft(timeLeftMs) : "initializing"}
              {isFetching && <Spinner className="h-3 w-3" />}
            </span>
          ) : (
            <span className="flex items-center gap-1 font-mono font-semibold text-foreground">
              Paused
            </span>
          )}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="cursor-pointer pl-2!">
              <ChevronDownIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="[--radius:1rem]">
            {refreshOptions.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.value}
                checked={refreshInterval === option.value}
                onCheckedChange={() => handleRefreshChange(option.value)}
                className="cursor-pointer text-foreground focus:bg-muted focus:text-foreground"
              >
                {option.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </ButtonGroup>
    </>
  )
}
