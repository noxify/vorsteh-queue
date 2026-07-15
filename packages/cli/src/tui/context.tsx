import { createContext, useContext, useMemo } from "react"

import type { Transport } from "../transport/types"

interface TransportContextValue {
  readonly transport: Transport
  readonly refreshInterval: number
}

const TransportContext = createContext<TransportContextValue | null>(null)

interface TransportProviderProps {
  readonly transport: Transport
  readonly refreshInterval: number
  readonly children: React.ReactNode
}

/**
 * Provides transport and refresh configuration to all TUI views.
 */
export function TransportProvider({
  transport,
  refreshInterval,
  children,
}: TransportProviderProps) {
  const value = useMemo(
    () => ({ refreshInterval, transport }),
    [refreshInterval, transport]
  )

  return <TransportContext value={value}>{children}</TransportContext>
}

/**
 * Access the transport and refresh interval from any TUI component.
 *
 * @throws {Error} If used outside TransportProvider
 */
export function useTransportContext(): TransportContextValue {
  const ctx = useContext(TransportContext)
  if (!ctx) {
    throw new Error("useTransportContext must be used within TransportProvider")
  }
  return ctx
}
