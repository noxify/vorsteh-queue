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
  const [token, setToken] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const endpoint = `${window.location.origin}/graphql`
      configureDashboard({ endpoint, token: token || undefined })
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
          <CardDescription>
            Enter your token to access the dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="token" className="text-sm font-medium">
                Bearer Token
              </label>
              <Input
                id="token"
                type="password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="Enter your access token"
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
