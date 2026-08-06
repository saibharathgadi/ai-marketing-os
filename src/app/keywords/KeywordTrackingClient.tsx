"use client"

import { useEffect, useState } from "react"
import { formatLocalTimestamp } from "@/lib/date"
import { analyzeCitationTrend } from "@/utils/citationTrend"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type KeywordCheck = {
  was_cited: boolean
  cited_domains: string[]
  competitor_domains: string[]
  created_at: string
}

type TrackedKeyword = {
  id: string
  keyword: string
  target_domain: string
  monitored_website_id: string | null
  status: "active" | "paused" | "archived"
  created_at: string
  keyword_checks: KeywordCheck[]
}

type MonitoredWebsite = {
  id: string
  url: string
}

export default function KeywordTrackingClient() {

  const [trackedKeywords, setTrackedKeywords] =
    useState<TrackedKeyword[]>([])

  const [monitoredWebsites, setMonitoredWebsites] =
    useState<MonitoredWebsite[]>([])

  const [keyword, setKeyword] = useState("")
  const [monitoredWebsiteId, setMonitoredWebsiteId] = useState("")
  const [targetDomain, setTargetDomain] = useState("")

  const [loading, setLoading] = useState(false)
  const [checkingNow, setCheckingNow] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  useEffect(() => {

    loadTrackedKeywords()
    loadMonitoredWebsites()

  }, [])

  async function loadTrackedKeywords() {

    try {

      const response = await fetch("/api/tracked-keywords")
      const result = await response.json()

      if (result.success) {
        setTrackedKeywords(result.data)
      }

    } catch (error) {

      console.error(error)

    }

  }

  async function loadMonitoredWebsites() {

    try {

      const response = await fetch("/api/monitored-websites")
      const result = await response.json()

      if (result.success) {
        setMonitoredWebsites(result.data)
      }

    } catch (error) {

      console.error(error)

    }

  }

  async function handleAddKeyword() {

    if (!keyword.trim()) return

    setLoading(true)

    try {

      const response =
        await fetch("/api/tracked-keywords", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            keyword: keyword.trim(),
            monitoredWebsiteId: monitoredWebsiteId || undefined,
            targetDomain:
              monitoredWebsiteId ? undefined : targetDomain.trim()
          })
        })

      const result = await response.json()

      if (!result.success) {
        setStatusMessage(
          result.error || "Failed to track keyword."
        )

        return
      }

      setTrackedKeywords((prev) => [result.data, ...prev])
      setKeyword("")
      setMonitoredWebsiteId("")
      setTargetDomain("")
      setStatusMessage("Keyword is now being tracked.")

    } catch (error) {

      console.error(error)
      setStatusMessage("Failed to track keyword.")

    } finally {

      setLoading(false)

    }

  }

  async function handleCheckNow() {

    setCheckingNow(true)

    try {

      const response =
        await fetch("/api/tracked-keywords/check-now", {
          method: "POST"
        })

      const result = await response.json()

      if (!result.success) {
        setStatusMessage(
          result.error || "Failed to check keywords."
        )

        return
      }

      await loadTrackedKeywords()

      const failedCount =
        result.results?.filter(
          (item: { success: boolean }) => !item.success
        ).length || 0

      setStatusMessage(
        failedCount > 0
          ? `Checked keywords with ${failedCount} skipped or failed.`
          : "Keyword checks completed."
      )

    } catch (error) {

      console.error(error)
      setStatusMessage("Failed to check keywords.")

    } finally {

      setCheckingNow(false)

    }

  }

  async function handleToggleStatus(
    id: string,
    currentStatus: TrackedKeyword["status"]
  ) {

    const nextStatus =
      currentStatus === "active" ? "paused" : "active"

    try {

      const response =
        await fetch(`/api/tracked-keywords/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ status: nextStatus })
        })

      const result = await response.json()

      if (!result.success) {
        setStatusMessage(
          result.error || "Failed to update keyword."
        )

        return
      }

      setTrackedKeywords((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, status: nextStatus }
            : item
        )
      )

    } catch (error) {

      console.error(error)

    }

  }

  async function handleDelete(id: string) {

    const confirmed = confirm("Stop tracking this keyword?")

    if (!confirmed) return

    try {

      const response =
        await fetch(`/api/tracked-keywords/${id}`, {
          method: "DELETE"
        })

      const result = await response.json()

      if (!result.success) {
        setStatusMessage(
          result.error || "Failed to delete keyword."
        )

        return
      }

      setTrackedKeywords((prev) =>
        prev.filter((item) => item.id !== id)
      )

      setStatusMessage("Keyword removed.")

    } catch (error) {

      console.error(error)

    }

  }

  return (

    <main className="relative min-h-screen bg-background text-foreground">

      <div className="max-w-5xl mx-auto px-6 py-12">

        <h1 className="text-3xl font-bold">
          Keyword Tracking
        </h1>

        <p className="text-muted-foreground mt-2">
          Track whether AI search (ChatGPT, Perplexity, Google AI
          Overviews) currently cites your site for the keywords that
          matter to you, and see which competitors it cites instead.
        </p>

        <Card className="rounded-2xl border border-border bg-card p-6 mt-8">

          <div className="flex items-center justify-between gap-4 flex-wrap">

            <div>
              <h2 className="text-xl font-semibold">
                Tracked Keywords
              </h2>
            </div>

            <Button
              onClick={handleCheckNow}
              disabled={checkingNow}
              size="lg"
              className="h-auto py-3 px-6"
            >
              {checkingNow ? "Checking…" : "Check Keywords Now"}
            </Button>

          </div>

          <div className="flex flex-col md:flex-row gap-4 mt-8">

            <input
              type="text"
              placeholder="e.g. best project management software"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="flex-1 rounded-xl bg-background border border-border px-5 py-4 outline-none focus:border-violet-500"
            />

            <select
              value={monitoredWebsiteId}
              onChange={(e) => setMonitoredWebsiteId(e.target.value)}
              className="rounded-xl bg-background border border-border px-5 py-4 outline-none focus:border-violet-500"
            >
              <option value="">No monitored website</option>
              {monitoredWebsites.map((website) => (
                <option key={website.id} value={website.id}>
                  {website.url}
                </option>
              ))}
            </select>

            {!monitoredWebsiteId && (
              <input
                type="text"
                placeholder="Target domain (e.g. example.com)"
                value={targetDomain}
                onChange={(e) => setTargetDomain(e.target.value)}
                className="flex-1 rounded-xl bg-background border border-border px-5 py-4 outline-none focus:border-violet-500"
              />
            )}

            <Button
              onClick={handleAddKeyword}
              disabled={loading}
              variant="outline"
              size="lg"
              className="h-auto py-4 px-6"
            >
              {loading ? "Tracking…" : "Track Keyword"}
            </Button>

          </div>

          {statusMessage && (
            <div className="mt-5 rounded-xl border border-border bg-background p-4 text-sm text-foreground">
              {statusMessage}
            </div>
          )}

          <div className="space-y-4 mt-8">

            {trackedKeywords.length === 0 ? (

              <div className="rounded-xl bg-background p-5 text-muted-foreground">
                No tracked keywords yet.
              </div>

            ) : (

              trackedKeywords.map((tracked) => {

                const [latestCheck, previousCheck] =
                  tracked.keyword_checks || []

                const trend =
                  analyzeCitationTrend({
                    currentCheck: latestCheck,
                    previousCheck
                  })

                return (

                  <div
                    key={tracked.id}
                    className="rounded-xl bg-background p-5 flex flex-col lg:flex-row lg:items-start justify-between gap-4"
                  >

                    <div>

                      <div className="flex items-center gap-2 flex-wrap">

                        <h3 className="text-lg font-semibold">
                          {tracked.keyword}
                        </h3>

                        {latestCheck && (
                          <Badge
                            variant={
                              latestCheck.was_cited
                                ? "default"
                                : "secondary"
                            }
                          >
                            {latestCheck.was_cited
                              ? "Cited"
                              : "Not Cited"}
                          </Badge>
                        )}

                        {trend.hasEnoughHistory &&
                          (trend.status === "Gained" ||
                            trend.status === "Lost") && (
                            <Badge
                              variant={
                                trend.status === "Gained"
                                  ? "default"
                                  : "destructive"
                              }
                            >
                              {trend.status === "Gained"
                                ? "▲ Gained"
                                : "▼ Lost"}
                            </Badge>
                          )}

                        {tracked.status === "paused" && (
                          <Badge variant="outline">Paused</Badge>
                        )}

                      </div>

                      <p className="text-muted-foreground text-sm mt-2">
                        Target: {tracked.target_domain}
                      </p>

                      <p className="text-muted-foreground text-sm mt-1">
                        Last checked:{" "}
                        {latestCheck
                          ? formatLocalTimestamp(latestCheck.created_at)
                          : "Never"}
                      </p>

                      {latestCheck &&
                        latestCheck.competitor_domains.length > 0 && (

                          <div className="mt-3 flex flex-wrap gap-2">

                            {latestCheck.competitor_domains.map(
                              (domain) => (
                                <Badge
                                  key={domain}
                                  variant="outline"
                                >
                                  {domain}
                                </Badge>
                              )
                            )}

                          </div>

                        )}

                    </div>

                    <div className="flex gap-3">

                      <Button
                        onClick={() =>
                          handleToggleStatus(
                            tracked.id,
                            tracked.status
                          )
                        }
                        variant="outline"
                        className="h-auto py-3 px-5"
                      >
                        {tracked.status === "active"
                          ? "Pause"
                          : "Resume"}
                      </Button>

                      <Button
                        onClick={() => handleDelete(tracked.id)}
                        variant="destructive"
                        className="h-auto py-3 px-5"
                      >
                        Delete
                      </Button>

                    </div>

                  </div>

                )

              })

            )}

          </div>

        </Card>

      </div>

    </main>

  )

}
