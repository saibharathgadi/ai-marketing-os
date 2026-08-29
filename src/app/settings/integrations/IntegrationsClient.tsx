"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent
} from "@/components/ui/card"
import { useToast } from "@/components/ToastProvider"

type Provider = "google_search_console" | "google_analytics"

type Connection = {
  provider: Provider
  expires_at: string | null
  created_at: string
  updated_at: string
}

const PROVIDERS: {
  id: Provider
  name: string
  description: string
}[] = [
  {
    id: "google_search_console",
    name: "Google Search Console",
    description:
      "Real query, click, and impression data for your own site — replaces AI-invented keyword clusters with what people actually search."
  },
  {
    id: "google_analytics",
    name: "Google Analytics 4",
    description:
      "Traffic and conversion data, used for the results/attribution view once an opportunity has been acted on."
  }
]

const ERROR_MESSAGES: Record<string, string> = {
  consent_denied: "Google sign-in was cancelled.",
  missing_params: "The connection attempt was missing required information.",
  invalid_state: "The connection attempt could not be verified.",
  invalid_provider: "Unknown integration provider.",
  invalid_nonce: "The connection attempt could not be verified. Please try again.",
  not_authenticated: "Please sign in and try again.",
  not_a_member: "You don't have access to that workspace.",
  storage_failed: "The connection succeeded but could not be saved. Please try again.",
  token_exchange_failed: "Failed to complete the connection with Google."
}

export default function IntegrationsClient() {

  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()

  const [connections, setConnections] =
    useState<Connection[]>([])

  const [loading, setLoading] =
    useState(true)

  const [pendingProvider, setPendingProvider] =
    useState<Provider | null>(null)

  useEffect(() => {

    loadConnections()

  }, [])

  useEffect(() => {

    const connected = searchParams.get("connected")
    const error = searchParams.get("error")

    if (connected) {
      const provider = PROVIDERS.find((p) => p.id === connected)
      toast({
        title: "Connected",
        description: provider ? provider.name : connected
      })
      router.replace("/settings/integrations")
    }

    if (error) {
      toast({
        title: "Connection failed",
        description: ERROR_MESSAGES[error] || "Something went wrong."
      })
      router.replace("/settings/integrations")
    }

    // Only run once per navigation to this page with query params present.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  async function loadConnections() {

    try {

      const response = await fetch("/api/integrations")
      const result = await response.json()

      if (result.success) {
        setConnections(result.data)
      }

    } catch (error) {

      console.error(error)

    } finally {

      setLoading(false)

    }

  }

  function isConnected(provider: Provider) {
    return connections.some((c) => c.provider === provider)
  }

  async function handleDisconnect(provider: Provider) {

    setPendingProvider(provider)

    try {

      const response =
        await fetch(`/api/integrations/${provider}`, {
          method: "DELETE"
        })

      const result = await response.json()

      if (!result.success) {
        toast({
          title: "Failed to disconnect",
          description: result.error || "Please try again."
        })
        return
      }

      await loadConnections()

      toast({ title: "Disconnected" })

    } catch (error) {

      console.error(error)
      toast({ title: "Failed to disconnect" })

    } finally {

      setPendingProvider(null)

    }

  }

  return (

    <main className="relative min-h-screen bg-background text-foreground">

      <div className="max-w-2xl mx-auto px-6 py-16">

        <h1 className="text-3xl font-bold">
          Integrations
        </h1>

        <p className="text-muted-foreground mt-2">
          Connect real data sources so Verolyx works from what actually
          happened, not just what the crawler can see.
        </p>

        {loading ? (

          <p className="text-muted-foreground mt-10">Loading…</p>

        ) : (

          <div className="space-y-4 mt-8">

            {PROVIDERS.map((provider) => (

              <Card
                key={provider.id}
                className="rounded-2xl border border-border bg-card p-6"
              >

                <CardHeader className="p-0">
                  <div className="flex items-center justify-between gap-4">
                    <CardTitle className="text-lg">
                      {provider.name}
                    </CardTitle>
                    {isConnected(provider.id) ? (
                      <span className="text-xs font-medium text-green-700 dark:text-green-300 bg-green-500/10 px-2.5 py-1 rounded-full">
                        Connected
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                        Not connected
                      </span>
                    )}
                  </div>
                  <CardDescription className="mt-1">
                    {provider.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-0 mt-4">
                  {isConnected(provider.id) ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDisconnect(provider.id)}
                      disabled={pendingProvider === provider.id}
                    >
                      {pendingProvider === provider.id
                        ? "Disconnecting…"
                        : "Disconnect"}
                    </Button>
                  ) : (
                    <Button asChild size="sm">
                      <a href={`/api/integrations/google/connect?provider=${provider.id}`}>
                        Connect
                      </a>
                    </Button>
                  )}
                </CardContent>

              </Card>

            ))}

          </div>

        )}

      </div>

    </main>

  )

}
