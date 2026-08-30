"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent
} from "@/components/ui/card"

type Competitor = {
  id: string
  url: string
  name: string | null
  created_at: string
}

export default function CompetitorsClient() {

  const [competitors, setCompetitors] =
    useState<Competitor[]>([])

  const [loading, setLoading] =
    useState(true)

  const [loadError, setLoadError] =
    useState(false)

  const [url, setUrl] =
    useState("")

  const [name, setName] =
    useState("")

  const [adding, setAdding] =
    useState(false)

  const [statusMessage, setStatusMessage] =
    useState<string | null>(null)

  async function loadCompetitors() {

    try {

      const response = await fetch("/api/competitors")
      const result = await response.json()

      if (!result.success) {
        setLoadError(true)
        return
      }

      setCompetitors(result.data)

    } catch (error) {

      console.error(error)
      setLoadError(true)

    } finally {

      setLoading(false)

    }

  }

  useEffect(() => {

    // setState only happens after loadCompetitors' internal `await`
    // resolves, never synchronously within this effect — fetch-on-mount,
    // not a cascading-render risk.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCompetitors()

  }, [])

  async function handleAdd() {

    if (!url.trim()) return

    setAdding(true)
    setStatusMessage(null)

    try {

      const response =
        await fetch("/api/competitors", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            url: url.trim(),
            name: name.trim()
          })
        })

      const result = await response.json()

      if (!result.success) {
        setStatusMessage(result.error || "Failed to add competitor.")
        return
      }

      setCompetitors((prev) => [result.data, ...prev])
      setUrl("")
      setName("")

    } catch (error) {

      console.error(error)
      setStatusMessage("Failed to add competitor.")

    } finally {

      setAdding(false)

    }

  }

  async function handleRemove(id: string) {

    try {

      const response =
        await fetch(`/api/competitors/${id}`, {
          method: "DELETE"
        })

      const result = await response.json()

      if (!result.success) {
        setStatusMessage(result.error || "Failed to remove competitor.")
        return
      }

      setCompetitors((prev) => prev.filter((competitor) => competitor.id !== id))

    } catch (error) {

      console.error(error)
      setStatusMessage("Failed to remove competitor.")

    }

  }

  return (

    <main className="relative min-h-screen bg-background text-foreground">

      <div className="max-w-2xl mx-auto px-6 py-16">

        <h1 className="text-3xl font-bold">
          Competitors
        </h1>

        <p className="text-muted-foreground mt-2">
          Name your real competitors so audit ideas compare against who you
          actually compete with, not a guess.
        </p>

        {loadError && (
          <p className="mt-4 text-sm text-destructive">
            Failed to load your competitors.
          </p>
        )}

        <Card className="rounded-2xl border border-border bg-card p-6 mt-8">

          <CardHeader>
            <CardTitle className="text-xl">
              Add a competitor
            </CardTitle>
            <CardDescription>
              Their site and (optionally) name — this feeds directly into
              the competitive comparisons in your audit ideas.
            </CardDescription>
          </CardHeader>

          <CardContent>

            <div className="flex flex-col md:flex-row gap-3">

              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="competitor.com"
                className="md:flex-1"
              />

              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name (optional)"
                className="md:w-48"
              />

              <Button onClick={handleAdd} disabled={adding || !url.trim()}>
                {adding ? "Adding…" : "Add"}
              </Button>

            </div>

            {statusMessage && (
              <p className="text-sm text-muted-foreground mt-3">
                {statusMessage}
              </p>
            )}

          </CardContent>

        </Card>

        {loading ? (

          <p className="text-muted-foreground mt-8">Loading…</p>

        ) : competitors.length === 0 ? (

          <div className="mt-8 rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
            No competitors added yet.
          </div>

        ) : (

          <div className="space-y-3 mt-8">

            {competitors.map((competitor) => (

              <div
                key={competitor.id}
                className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-4"
              >

                <div>

                  {competitor.name && (
                    <p className="text-sm font-medium text-foreground">
                      {competitor.name}
                    </p>
                  )}

                  <p className="text-sm text-muted-foreground">
                    {competitor.url}
                  </p>

                </div>

                <Button
                  onClick={() => handleRemove(competitor.id)}
                  variant="destructive"
                  size="sm"
                >
                  Remove
                </Button>

              </div>

            ))}

          </div>

        )}

      </div>

    </main>

  )

}
