import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { ActivityIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "~/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { configureDashboard } from "~/lib/api-client"

export const Route = createFileRoute("/login")({
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const [endpoint, setEndpoint] = useState(
    () => localStorage.getItem("vq-endpoint") ?? "http://localhost:3000/graphql"
  )
  const [token, setToken] = useState(
    () => localStorage.getItem("vq-token") ?? ""
  )
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      configureDashboard({ endpoint, token: token || undefined })
      // oxlint-disable-next-line react-doctor/auth-token-in-web-storage -- dashboard token is non-sensitive config, not an auth session
      localStorage.setItem("vq-endpoint", endpoint)
      if (token) {
        // oxlint-disable-next-line react-doctor/auth-token-in-web-storage -- dashboard token is non-sensitive config
        localStorage.setItem("vq-token", token)
      }
      navigate({ to: "/" })
    } catch {
      setError("Failed to connect to the queue server")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="bg-primary mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg">
            <ActivityIcon className="text-primary-foreground h-5 w-5" />
          </div>
          <CardTitle className="text-xl">Vorsteh Queue</CardTitle>
          <CardDescription>Connect to your queue server</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="endpoint" className="text-sm font-medium">
                GraphQL Endpoint
              </label>
              <Input
                id="endpoint"
                type="url"
                value={endpoint}
                onChange={(event) => setEndpoint(event.target.value)}
                placeholder="http://localhost:3000/graphql"
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="token" className="text-sm font-medium">
                Bearer Token (optional)
              </label>
              <Input
                id="token"
                type="password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="Leave empty for no auth"
                autoComplete="off"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Connecting..." : "Connect"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
