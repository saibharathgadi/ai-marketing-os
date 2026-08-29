"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { formatLocalTimestamp } from "@/lib/date"
import DashboardCharts from "@/components/DashboardCharts"
import MonitoredWebsites from "@/components/MonitoredWebsites"
import StatCard from "@/components/StatCard"
import { isMissingColumnError } from "@/utils/schemaCompat"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent
} from "@/components/ui/tabs"

type EngineScore = {
  score: number
  issues: string[]
}

type TechnicalSeo = {
  aeo?: EngineScore
  aio?: EngineScore
  geo?: EngineScore
} | null

type Audit = {
  id: string
  url: string
  average_score: number
  total_pages: number
  total_issues: number
  created_at: string
  crawl_duration_ms?: number | null
  crawl_failure_reason?: string | null
  crawl_status?: string | null
  is_slow?: boolean | null
  technical_seo?: TechnicalSeo
  ai_insights?: {
    executiveSummary?: string
    weeklyFocus?: string
    priorityActions?: {
      title: string
    }[]
    contentIdeas?: {
      title: string
      description: string
      type: "blog" | "social" | "landing-page"
    }[]
    socialIdeas?: {
      platform: string
      idea: string
    }[]
    adCampaigns?: {
      name: string
      objective: string
    }[]
  } | null
}

type QueueMetrics = {
  queued: number
  running: number
  failed: number
  failedByReason?: Record<string, number>
}

const defaultQueueMetrics: QueueMetrics = {
  queued: 0,
  running: 0,
  failed: 0,
  failedByReason: {}
}

const auditSelect =
  "id,url,average_score,total_pages,total_issues,created_at,crawl_duration_ms,crawl_failure_reason,crawl_status,is_slow,ai_insights,technical_seo"

const fallbackAuditSelect =
  "id,url,average_score,total_pages,total_issues,created_at"

function isMissingDiagnosticsColumn(
  message: string
) {
  return isMissingColumnError(
    message,
    [
      "crawl_duration_ms",
      "crawl_failure_reason",
      "crawl_status",
      "is_slow",
      "ai_insights",
      "technical_seo"
    ]
  )
}

function EngineScorePill({
  label,
  engine
}: {
  label: string
  engine?: EngineScore
}) {
  if (!engine || typeof engine.score !== "number") {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        {label}: n/a
      </Badge>
    )
  }

  const variant =
    engine.score >= 80
      ? "default"
      : engine.score >= 60
        ? "secondary"
        : "destructive"

  return (
    <Badge variant={variant}>
      {label}: {engine.score}
    </Badge>
  )
}

function average(values: number[]) {
  if (values.length === 0) {
    return null
  }

  return Math.round(
    values.reduce((sum, value) => sum + value, 0) /
      values.length
  )
}

function AuditCardSkeleton() {
  return (

    <div
      className="rounded-2xl border border-border bg-card p-6 animate-pulse"
      aria-hidden="true"
    >

      <div className="h-3 w-16 rounded bg-muted" />

      <div className="h-5 w-3/4 rounded bg-muted mt-3" />

      <div className="grid grid-cols-3 gap-4 mt-8">

        <div className="h-8 rounded bg-muted" />

        <div className="h-8 rounded bg-muted" />

        <div className="h-8 rounded bg-muted" />

      </div>

      <div className="h-3 w-1/3 rounded bg-muted mt-8" />

      <div className="h-16 rounded-xl bg-background mt-6" />

    </div>

  )
}

export default function DashboardClient() {

  const [supabase] = useState(createClient)

  const [audits, setAudits] =
    useState<Audit[]>([])

  const [loading, setLoading] =
    useState(true)

  const [queueMetrics, setQueueMetrics] =
    useState(defaultQueueMetrics)

  const [selectedAuditIds, setSelectedAuditIds] =
    useState<Set<string>>(new Set())

  const [bulkDeleting, setBulkDeleting] =
    useState(false)

  const loadDiagnostics = useCallback(
    async () => {
      try {
        const response =
          await fetch("/api/diagnostics")
        const result =
          await response.json()

        if (result.success) {
          setQueueMetrics({
            queued:
              result.queue?.queued || 0,
            running:
              result.queue?.running || 0,
            failed:
              result.queue?.failed || 0,
            failedByReason:
              result.queue?.failedByReason || {}
          })
        }
      } catch (error) {
        console.error(error)
      }
    },
    []
  )

  const loadAudits = useCallback(
    async () => {

    try {

      let response =
        await supabase
          .from("audits")
          .select(auditSelect)
          .order("created_at", {
            ascending: false
          })
          .limit(100)
          .then((result) => result as {
            data: Audit[] | null
            error: { message: string } | null
          })

      if (
        response.error &&
        isMissingDiagnosticsColumn(
          response.error.message
        )
      ) {
        response =
          await supabase
            .from("audits")
            .select(fallbackAuditSelect)
            .order("created_at", {
              ascending: false
            })
            .limit(100)
            .then((result) => result as {
              data: Audit[] | null
              error: {
                message: string
              } | null
            })
      }

      if (response.error) {

        console.error(response.error)

        return

      }

      setAudits(
        (response.data || []).map(
          (audit) => ({
            ...audit,
            crawl_duration_ms:
              "crawl_duration_ms" in audit
                ? audit.crawl_duration_ms
                : null,
            crawl_failure_reason:
              "crawl_failure_reason" in audit
                ? audit.crawl_failure_reason
                : null,
            crawl_status:
              "crawl_status" in audit
                ? audit.crawl_status
                : null,
            is_slow:
              "is_slow" in audit
                ? audit.is_slow
                : false,
            ai_insights:
              "ai_insights" in audit
                ? audit.ai_insights
                : null,
            technical_seo:
              "technical_seo" in audit
                ? audit.technical_seo
                : null
          })
        )
      )

    } catch (error) {

      console.error(error)

    } finally {

      setLoading(false)

    }

    },
    [supabase]
  )

  useEffect(() => {

    // setState only happens after loadAudits' internal `await` resolves,
    // never synchronously within this effect — fetch-on-mount, not a
    // cascading-render risk.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAudits()

  }, [loadAudits])

  useEffect(() => {

    function pollIfVisible() {
      if (document.visibilityState === "visible") {
        loadDiagnostics()
      }
    }

    const interval =
      window.setInterval(pollIfVisible, 2000)

    // eslint-disable-next-line react-hooks/set-state-in-effect -- see note above
    loadDiagnostics()

    document.addEventListener(
      "visibilitychange",
      pollIfVisible
    )

    return () => {
      window.clearInterval(interval)
      document.removeEventListener(
        "visibilitychange",
        pollIfVisible
      )
    }

  }, [loadDiagnostics])

  const healthAverages = useMemo(() => {
    const seoScores = audits.map((audit) => audit.average_score)

    const aeoScores = audits
      .map((audit) => audit.technical_seo?.aeo?.score)
      .filter((score): score is number => typeof score === "number")

    const aioScores = audits
      .map((audit) => audit.technical_seo?.aio?.score)
      .filter((score): score is number => typeof score === "number")

    const geoScores = audits
      .map((audit) => audit.technical_seo?.geo?.score)
      .filter((score): score is number => typeof score === "number")

    return {
      seo: average(seoScores),
      aeo: average(aeoScores),
      aio: average(aioScores),
      geo: average(geoScores)
    }
  }, [audits])

  const latestIdeas = useMemo(() => {
    const withInsights = audits.find(
      (audit) =>
        audit.ai_insights &&
        ((audit.ai_insights.contentIdeas?.length ?? 0) > 0 ||
          (audit.ai_insights.socialIdeas?.length ?? 0) > 0 ||
          (audit.ai_insights.adCampaigns?.length ?? 0) > 0)
    )

    if (!withInsights) {
      return null
    }

    return {
      auditId: withInsights.id,
      url: withInsights.url,
      blogIdea: withInsights.ai_insights?.contentIdeas?.find(
        (idea) => idea.type === "blog"
      ),
      socialIdea: withInsights.ai_insights?.socialIdeas?.[0],
      adCampaign: withInsights.ai_insights?.adCampaigns?.[0]
    }
  }, [audits])

  async function deleteAuditById(
    auditId: string
  ) {

    const response =
      await fetch(
        `/api/audit/${auditId}`,
        {
          method: "DELETE"
        }
      )

    const result =
      await response.json()

    return result.success as boolean

  }

  async function handleDelete(
    auditId: string
  ) {

    const confirmed =
      confirm(
        "Delete this audit permanently?"
      )

    if (!confirmed) return

    try {

      const success =
        await deleteAuditById(auditId)

      if (!success) {

        alert("Failed to delete audit")

        return

      }

      setAudits((prev) =>
        prev.filter(
          (audit) =>
            audit.id !== auditId
        )
      )

      setSelectedAuditIds((prev) => {
        const next = new Set(prev)
        next.delete(auditId)
        return next
      })

    } catch (error) {

      console.error(error)

      alert("Something went wrong")

    }

  }

  function toggleAuditSelected(
    auditId: string
  ) {

    setSelectedAuditIds((prev) => {
      const next = new Set(prev)

      if (next.has(auditId)) {
        next.delete(auditId)
      } else {
        next.add(auditId)
      }

      return next
    })

  }

  function toggleSelectAll() {

    setSelectedAuditIds((prev) =>
      prev.size === audits.length
        ? new Set()
        : new Set(audits.map((audit) => audit.id))
    )

  }

  async function handleBulkDelete() {

    if (selectedAuditIds.size === 0) return

    const confirmed =
      confirm(
        `Delete ${selectedAuditIds.size} selected audit${
          selectedAuditIds.size === 1 ? "" : "s"
        } permanently?`
      )

    if (!confirmed) return

    setBulkDeleting(true)

    try {

      const idsToDelete = [...selectedAuditIds]

      const results =
        await Promise.all(
          idsToDelete.map((id) =>
            deleteAuditById(id).catch(() => false)
          )
        )

      const deletedIds =
        idsToDelete.filter((_, index) => results[index])

      setAudits((prev) =>
        prev.filter(
          (audit) => !deletedIds.includes(audit.id)
        )
      )

      setSelectedAuditIds(new Set())

      if (deletedIds.length < idsToDelete.length) {
        alert(
          `Deleted ${deletedIds.length} of ${idsToDelete.length} audits. Some failed — please retry.`
        )
      }

    } catch (error) {

      console.error(error)

      alert("Something went wrong deleting the selected audits.")

    } finally {

      setBulkDeleting(false)

    }

  }

  return (

    <main className="relative min-h-screen bg-background text-foreground">

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] bg-[image:var(--gradient-glow)]"
      />

      <div className="max-w-7xl mx-auto px-6 py-12">

        <div className="flex items-center justify-between gap-6 flex-wrap">

          <div>

            <h1 className="text-5xl font-bold">
              Dashboard
            </h1>

            <p className="text-muted-foreground mt-3">
              Marketing health, ideas, and audit history across your sites.
            </p>

          </div>

          <Button asChild size="lg" className="h-auto py-3 px-6">
            <Link href="/">
              + New Audit
            </Link>
          </Button>

        </div>

        <Tabs defaultValue="overview" className="mt-10">

          <TabsList variant="line" className="border-b border-border pb-0">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="sites">Sites & Audits</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-8 space-y-8">

            {!loading && audits.length > 0 && (

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

                <StatCard label="Avg SEO" value={healthAverages.seo ?? "—"} />
                <StatCard label="Avg AEO" value={healthAverages.aeo ?? "—"} />
                <StatCard label="Avg AIO" value={healthAverages.aio ?? "—"} />
                <StatCard label="Avg GEO" value={healthAverages.geo ?? "—"} />

              </div>

            )}

            {latestIdeas && (

              <Card className="border border-border bg-card p-6">

                <div className="flex items-center justify-between gap-4 flex-wrap">

                  <h2 className="text-lg font-semibold">
                    Marketing Ideas — from your latest audit
                  </h2>

                  <Link
                    href={`/audit/${latestIdeas.auditId}`}
                    className="text-sm text-violet-400 hover:text-violet-700 dark:text-violet-300"
                  >
                    View full breakdown →
                  </Link>

                </div>

                <p className="text-muted-foreground text-sm mt-1 break-all">
                  {latestIdeas.url}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">

                  {latestIdeas.blogIdea && (

                    <div className="rounded-xl bg-background border border-border p-4">
                      <Badge variant="secondary">Blog</Badge>
                      <p className="text-sm font-medium mt-2">
                        {latestIdeas.blogIdea.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {latestIdeas.blogIdea.description}
                      </p>
                    </div>

                  )}

                  {latestIdeas.socialIdea && (

                    <div className="rounded-xl bg-background border border-border p-4">
                      <Badge variant="secondary">
                        {latestIdeas.socialIdea.platform}
                      </Badge>
                      <p className="text-sm mt-2">
                        {latestIdeas.socialIdea.idea}
                      </p>
                    </div>

                  )}

                  {latestIdeas.adCampaign && (

                    <div className="rounded-xl bg-background border border-border p-4">
                      <Badge variant="secondary">Ad Campaign</Badge>
                      <p className="text-sm font-medium mt-2">
                        {latestIdeas.adCampaign.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {latestIdeas.adCampaign.objective}
                      </p>
                    </div>

                  )}

                </div>

              </Card>

            )}

            {!loading && audits.length === 0 && (

              <div className="rounded-2xl border border-border bg-card p-8">

                <h2 className="text-2xl font-semibold">
                  No audits yet
                </h2>

              </div>

            )}

          </TabsContent>

          <TabsContent value="analytics" className="mt-8">

            <DashboardCharts
              audits={audits}
              queueMetrics={queueMetrics}
            />

          </TabsContent>

          <TabsContent value="sites" className="mt-8 space-y-8">

            <MonitoredWebsites
              onAuditCompleted={loadAudits}
            />

            {loading ? (

              <div
                className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
                role="status"
                aria-label="Loading audits"
              >

                {Array.from({ length: 3 }).map(
                  (_, index) => (
                    <AuditCardSkeleton key={index} />
                  )
                )}

              </div>

            ) : audits.length === 0 ? (

              <div className="rounded-2xl border border-border bg-card p-8">

                <h2 className="text-2xl font-semibold">
                  No audits yet
                </h2>

              </div>

            ) : (

              <>

                <div className="flex items-center justify-between gap-4 flex-wrap">

                  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={
                        selectedAuditIds.size > 0 &&
                        selectedAuditIds.size === audits.length
                      }
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-border bg-background accent-violet-500"
                    />
                    {selectedAuditIds.size > 0
                      ? `${selectedAuditIds.size} selected`
                      : "Select all"}
                  </label>

                  {selectedAuditIds.size > 0 && (
                    <Button
                      onClick={handleBulkDelete}
                      disabled={bulkDeleting}
                      variant="destructive"
                      size="sm"
                    >
                      {bulkDeleting
                        ? "Deleting…"
                        : `Delete ${selectedAuditIds.size} selected`}
                    </Button>
                  )}

                </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

                {audits.map((audit) => (

                  <div
                    key={audit.id}
                    className={`rounded-2xl border p-6 transition ${
                      selectedAuditIds.has(audit.id)
                        ? "border-violet-500/50 bg-card"
                        : "border-border bg-card"
                    }`}
                  >

                    <div className="flex items-start justify-between gap-4">

                      <div className="flex items-start gap-3 flex-1 min-w-0">

                        <input
                          type="checkbox"
                          checked={selectedAuditIds.has(audit.id)}
                          onChange={() =>
                            toggleAuditSelected(audit.id)
                          }
                          aria-label={`Select audit for ${audit.url}`}
                          className="h-4 w-4 mt-1 rounded border-border bg-background accent-violet-500 shrink-0"
                        />

                        <Link
                          href={`/audit/${audit.id}`}
                          className="flex-1 min-w-0"
                        >

                          <p className="text-muted-foreground text-sm">
                            Website
                          </p>

                          <h2 className="text-xl font-semibold mt-2 break-all">
                            {audit.url}
                          </h2>

                        </Link>

                      </div>

                      <button
                        onClick={() =>
                          handleDelete(
                            audit.id
                          )
                        }
                        aria-label={`Delete audit for ${audit.url}`}
                        title="Delete audit"
                        className="text-muted-foreground hover:text-red-400 transition text-xl shrink-0"
                      >
                        ✕
                      </button>

                    </div>

                    <div className="grid grid-cols-3 gap-4 mt-8">

                      <div>

                        <p className="text-muted-foreground text-xs">
                          Score
                        </p>

                        <h3 className="text-3xl font-bold mt-1">
                          {audit.average_score}
                        </h3>

                      </div>

                      <div>

                        <p className="text-muted-foreground text-xs">
                          Pages
                        </p>

                        <h3 className="text-3xl font-bold mt-1">
                          {audit.total_pages}
                        </h3>

                      </div>

                      <div>

                        <p className="text-muted-foreground text-xs">
                          Issues
                        </p>

                        <h3 className="text-3xl font-bold mt-1">
                          {audit.total_issues}
                        </h3>

                      </div>

                    </div>

                    <div className="flex flex-wrap gap-2 mt-6">
                      <EngineScorePill
                        label="AEO"
                        engine={audit.technical_seo?.aeo}
                      />
                      <EngineScorePill
                        label="AIO"
                        engine={audit.technical_seo?.aio}
                      />
                      <EngineScorePill
                        label="GEO"
                        engine={audit.technical_seo?.geo}
                      />
                    </div>

                    <p className="text-muted-foreground text-sm mt-4">
                      {formatLocalTimestamp(
                        audit.created_at
                      )}
                    </p>

                    {audit.ai_insights ? (

                      <div className="mt-6 rounded-xl border border-border bg-background p-4 space-y-4">

                        <div>

                          <h3 className="text-sm font-semibold text-foreground">
                            AI Executive Summary
                          </h3>

                          <p className="text-sm text-muted-foreground mt-2">
                            {
                              audit.ai_insights
                                .executiveSummary
                            }
                          </p>

                        </div>

                        <div>

                          <h4 className="text-sm font-medium text-foreground">
                            Weekly Focus
                          </h4>

                          <p className="text-sm text-muted-foreground mt-2">
                            {
                              audit.ai_insights
                                .weeklyFocus
                            }
                          </p>

                        </div>

                        {Array.isArray(
                          audit.ai_insights
                            .priorityActions
                        ) &&
                          audit.ai_insights
                            .priorityActions.length >
                            0 && (

                          <div>

                            <h4 className="text-sm font-medium text-foreground mb-2">
                              Top Priorities
                            </h4>

                            <ul className="space-y-2 text-sm text-foreground">

                              {audit.ai_insights.priorityActions
                                .slice(0, 3)
                                .map(
                                  (
                                    action,
                                    index
                                  ) => (

                                    <li key={index}>
                                      {action.title}
                                    </li>

                                  )
                                )}

                            </ul>

                          </div>

                        )}

                      </div>

                    ) : (

                      <p className="mt-6 text-sm text-muted-foreground">
                        AI insights not available for this audit.
                      </p>

                    )}

                  </div>

                ))}

              </div>

              </>

            )}

          </TabsContent>

        </Tabs>

      </div>

    </main>

  )

}
