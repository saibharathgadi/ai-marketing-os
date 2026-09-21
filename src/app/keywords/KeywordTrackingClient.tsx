"use client"

import { useEffect, useState } from "react"
import { formatLocalTimestamp } from "@/lib/date"
import { analyzeCitationTrend } from "@/utils/citationTrend"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ActivityIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  CrosshairIcon,
  Globe2Icon,
  PauseCircleIcon,
  PlayCircleIcon,
  RefreshCwIcon,
  SearchIcon,
  Trash2Icon,
  TrendingUpIcon
} from "lucide-react"

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

  const hasKeyword =
    keyword.trim().length > 0

  const hasTarget =
    Boolean(monitoredWebsiteId) || targetDomain.trim().length > 0

  const canTrackKeyword =
    hasKeyword && hasTarget && !loading

  const activeKeywordCount =
    trackedKeywords.filter((item) => item.status === "active").length

  const latestCitedCount =
    trackedKeywords.filter((item) => item.keyword_checks?.[0]?.was_cited)
      .length

  const pausedKeywordCount =
    trackedKeywords.filter((item) => item.status === "paused").length

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

    if (!hasKeyword) {
      setStatusMessage("Enter a keyword to track.")
      return
    }

    if (!hasTarget) {
      setStatusMessage(
        "Select a monitored website or enter a target domain."
      )
      return
    }

    setLoading(true)
    setStatusMessage(null)

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

    <main className="relative min-h-screen bg-background text-foreground bg-[image:var(--gradient-glow)] bg-no-repeat">

      <div className="max-w-6xl mx-auto px-6 py-12">

        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">

          <div>
            <Badge variant="outline" className="mb-4">
              <ActivityIcon data-icon="inline-start" />
              AI visibility monitor
            </Badge>

            <h1 className="text-3xl font-bold">
              Keyword Tracking
            </h1>

            <p className="max-w-2xl text-muted-foreground mt-2">
              Track whether AI search cites your site for the
              keywords that matter, and see which competitors are
              being surfaced instead.
            </p>
          </div>

          <Button
            onClick={handleCheckNow}
            disabled={checkingNow || trackedKeywords.length === 0}
            size="lg"
            className="h-auto py-3 px-5"
            title={
              trackedKeywords.length === 0
                ? "Add a keyword before running checks."
                : undefined
            }
          >
            <RefreshCwIcon
              data-icon="inline-start"
              className={checkingNow ? "animate-spin" : undefined}
            />
            {checkingNow ? "Checking" : "Check now"}
          </Button>

        </div>

        <div className="grid gap-4 mt-8 sm:grid-cols-3">

          <div className="rounded-xl border border-border bg-card/80 p-4 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">Active</p>
              <CrosshairIcon className="size-4 text-primary" />
            </div>
            <p className="mt-3 text-3xl font-semibold">
              {activeKeywordCount}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card/80 p-4 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">Cited now</p>
              <CheckCircle2Icon className="size-4 text-emerald-500" />
            </div>
            <p className="mt-3 text-3xl font-semibold">
              {latestCitedCount}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card/80 p-4 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">Paused</p>
              <PauseCircleIcon className="size-4 text-amber-500" />
            </div>
            <p className="mt-3 text-3xl font-semibold">
              {pausedKeywordCount}
            </p>
          </div>

        </div>

        <Card className="rounded-2xl border border-border bg-card p-6 mt-8">

          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.6fr)]">

            <div className="rounded-xl border border-border bg-background/70 p-5">

              <div className="flex items-start gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <SearchIcon className="size-4" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold">
                    Add keyword
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Choose the query and the site you want AI answers
                    to cite.
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-4">

                <div>
                  <label
                    className="text-sm font-medium"
                    htmlFor="keyword-to-track"
                  >
                    Keyword
                  </label>
                  <input
                    id="keyword-to-track"
                    type="text"
                    placeholder="e.g. best project management software"
                    value={keyword}
                    onChange={(e) => {
                      setKeyword(e.target.value)
                      setStatusMessage(null)
                    }}
                    className="mt-2 w-full rounded-xl bg-card border border-border px-4 py-3 outline-none transition focus:border-primary focus:ring-3 focus:ring-ring/30"
                  />
                </div>

                <div>
                  <label
                    className="text-sm font-medium"
                    htmlFor="monitored-website"
                  >
                    Website
                  </label>
                  <div className="relative mt-2">
                    <Globe2Icon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <select
                      id="monitored-website"
                      value={monitoredWebsiteId}
                      onChange={(e) => {
                        setMonitoredWebsiteId(e.target.value)
                        setStatusMessage(null)
                      }}
                      className="w-full appearance-none rounded-xl bg-card border border-border py-3 pl-10 pr-4 outline-none transition focus:border-primary focus:ring-3 focus:ring-ring/30"
                    >
                      <option value="">Use a custom domain</option>
                      {monitoredWebsites.map((website) => (
                        <option key={website.id} value={website.id}>
                          {website.url}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {!monitoredWebsiteId && (
                  <div>
                    <label
                      className="text-sm font-medium"
                      htmlFor="target-domain"
                    >
                      Target domain
                    </label>
                    <input
                      id="target-domain"
                      type="text"
                      placeholder="example.com"
                      value={targetDomain}
                      onChange={(e) => {
                        setTargetDomain(e.target.value)
                        setStatusMessage(null)
                      }}
                      className="mt-2 w-full rounded-xl bg-card border border-border px-4 py-3 outline-none transition focus:border-primary focus:ring-3 focus:ring-ring/30"
                    />
                  </div>
                )}

                <Button
                  onClick={handleAddKeyword}
                  disabled={!canTrackKeyword}
                  size="lg"
                  className="h-auto w-full py-3"
                  title={
                    canTrackKeyword
                      ? undefined
                      : "Enter a keyword and target before tracking."
                  }
                >
                  <CrosshairIcon data-icon="inline-start" />
                  {loading ? "Tracking" : "Track keyword"}
                </Button>

                {!canTrackKeyword && !loading && (
                  <p className="text-sm text-muted-foreground">
                    Enter a keyword, then select a monitored website or
                    add a target domain.
                  </p>
                )}

                {statusMessage && (
                  <div className="rounded-xl border border-border bg-card p-3 text-sm text-foreground">
                    {statusMessage}
                  </div>
                )}

              </div>

            </div>

            <div>

              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">
                    Visibility watchlist
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Latest citation status by target domain.
                  </p>
                </div>
                <Badge variant="secondary">
                  {trackedKeywords.length} total
                </Badge>
              </div>

              <div className="space-y-3 mt-5">

                {trackedKeywords.length === 0 ? (

                  <div className="rounded-xl border border-dashed border-border bg-background/70 p-8 text-center">
                    <CircleDashedIcon className="mx-auto size-8 text-muted-foreground" />
                    <h3 className="mt-4 font-semibold">
                      No keywords yet
                    </h3>
                    <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                      Add your first keyword to start tracking AI
                      citation coverage against your domain.
                    </p>
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
                        className="rounded-xl border border-border bg-background/70 p-4 transition hover:border-primary/40 hover:bg-background"
                      >

                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

                          <div className="min-w-0">

                            <div className="flex items-center gap-2 flex-wrap">

                              <h3 className="text-base font-semibold">
                                {tracked.keyword}
                              </h3>

                              {latestCheck ? (
                                <Badge
                                  variant={
                                    latestCheck.was_cited
                                      ? "default"
                                      : "secondary"
                                  }
                                >
                                  {latestCheck.was_cited
                                    ? "Cited"
                                    : "Not cited"}
                                </Badge>
                              ) : (
                                <Badge variant="outline">Unchecked</Badge>
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
                                    <TrendingUpIcon data-icon="inline-start" />
                                    {trend.status}
                                  </Badge>
                                )}

                              {tracked.status === "paused" && (
                                <Badge variant="outline">Paused</Badge>
                              )}

                            </div>

                            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                              <span className="inline-flex items-center gap-1.5">
                                <Globe2Icon className="size-4" />
                                {tracked.target_domain}
                              </span>
                              <span>
                                Last checked:{" "}
                                {latestCheck
                                  ? formatLocalTimestamp(
                                      latestCheck.created_at
                                    )
                                  : "Never"}
                              </span>
                            </div>

                            {latestCheck &&
                              latestCheck.competitor_domains.length > 0 && (

                                <div className="mt-4">
                                  <p className="text-xs uppercase text-muted-foreground">
                                    Competitors cited
                                  </p>
                                  <div className="mt-2 flex flex-wrap gap-2">

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
                                </div>

                              )}

                          </div>

                          <div className="flex shrink-0 gap-2">

                            <Button
                              onClick={() =>
                                handleToggleStatus(
                                  tracked.id,
                                  tracked.status
                                )
                              }
                              variant="outline"
                              size="sm"
                            >
                              {tracked.status === "active" ? (
                                <PauseCircleIcon data-icon="inline-start" />
                              ) : (
                                <PlayCircleIcon data-icon="inline-start" />
                              )}
                              {tracked.status === "active"
                                ? "Pause"
                                : "Resume"}
                            </Button>

                            <Button
                              onClick={() => handleDelete(tracked.id)}
                              variant="destructive"
                              size="sm"
                              aria-label={`Delete ${tracked.keyword}`}
                            >
                              <Trash2Icon data-icon="inline-start" />
                              Delete
                            </Button>

                          </div>

                        </div>

                      </div>

                    )

                  })

                )}

              </div>

            </div>

          </div>

        </Card>

      </div>

    </main>

  )

}
