import type { ResultOf, TadaDocumentNode, VariablesOf } from "gql.tada"
import { GraphQLClient } from "graphql-request"

/**
 * Dashboard configuration provided at initialization.
 */
export interface DashboardConfig {
  /** GraphQL endpoint URL */
  readonly endpoint: string
  /** Optional Bearer token for authentication */
  readonly token?: string
}

let _config: DashboardConfig = {
  endpoint: "/graphql",
}

let _client: GraphQLClient | undefined

/**
 * Configure the dashboard API client.
 *
 * @param options - Dashboard configuration
 */
export function configureDashboard(options: DashboardConfig): void {
  _config = options
  _client = undefined
}

/**
 * Get (or create) the GraphQL client singleton.
 */
function getClient(): GraphQLClient {
  if (!_client) {
    const headers: Record<string, string> = {}
    if (_config.token) {
      headers.Authorization = `Bearer ${_config.token}`
    }
    _client = new GraphQLClient(_config.endpoint, { headers })
  }
  return _client
}

/**
 * Execute a type-safe GraphQL operation against the configured endpoint.
 *
 * @param document - A gql.tada typed document node
 * @param variables - Variables matching the document's input types
 * @returns Typed response data
 *
 * @example
 * ```typescript
 * const data = await request(StatsQuery)
 * // data.stats.pending is typed as number
 * ```
 */
export async function request<TResult, TVariables>(
  document: TadaDocumentNode<TResult, TVariables>,
  variables?: VariablesOf<TadaDocumentNode<TResult, TVariables>>
): Promise<ResultOf<TadaDocumentNode<TResult, TVariables>>> {
  const client = getClient()
  return client.request(
    document,
    variables as Record<string, unknown> | undefined
  )
}
