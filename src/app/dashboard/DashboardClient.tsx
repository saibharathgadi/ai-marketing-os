"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { formatLocalTimestamp } from "@/lib/date"
import DashboardCharts from "@/components/DashboardCharts"
import MonitoredWebsites from "@/components/MonitoredWebsites"
import { isMissingColumnError } from "@/utils/schemaCompat"

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
  ai_insights?: {
    executiveSummary?: string
    weeklyFocus?: string
    priorityActions?: {
      title: string
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
  "id,url,average_score,total_pages,total_issues,created_at,crawl_duration_ms,crawl_failure_reason,crawl_status,is_slow,ai_insights"

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
      "ai_insights"
    ]
  )
}

function AuditCardSkeleton() {
  return (

    <div
      className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 animate-pulse"
      aria-hidden="true"
    >

      <div className="h-3 w-16 rounded bg-zinc-800" />

      <div className="h-5 w-3/4 rounded bg-zinc-800 mt-3" />

      <div className="grid grid-cols-3 gap-4 mt-8">

        <div className="h-8 rounded bg-zinc-800" />

        <div className="h-8 rounded bg-zinc-800" />

        <div className="h-8 rounded bg-zinc-800" />

      </div>

      <div className="h-3 w-1/3 rounded bg-zinc-800 mt-8" />

      <div className="h-16 rounded-xl bg-zinc-950 mt-6" />

    </div>

  )
}

export default function DashboardClient() {

  const [audits, setAudits] =
    useState<Audit[]>([])

  const [loading, setLoading] =
    useState(true)

  const [queueMetrics, setQueueMetrics] =
    useState(defaultQueueMetrics)

  useEffect(() => {

    loadAudits()

  }, [])

  useEffect(() => {

    function pollIfVisible() {
      if (document.visibilityState === "visible") {
        loadDiagnostics()
      }
    }

    const interval =
      window.setInterval(pollIfVisible, 2000)

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

  }, [])

  async function loadDiagnostics() {
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
  }

  async function loadAudits() {

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
                : null
          })
        )
      )

    } catch (error) {

      console.error(error)

    } finally {

      setLoading(false)

    }

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

      const response =
        await fetch(
          `/api/audit/${auditId}`,
          {
            method: "DELETE"
          }
        )

      const result =
        await response.json()

      if (!result.success) {

        alert("Failed to delete audit")

        return

      }

      setAudits((prev) =>
        prev.filter(
          (audit) =>
            audit.id !== auditId
        )
      )

    } catch (error) {

      console.error(error)

      alert("Something went wrong")

    }

  }

  return (

    <main className="min-h-screen bg-black text-white">

      <div className="max-w-7xl mx-auto px-6 py-12">

        <div className="flex items-center justify-between gap-6 flex-wrap">

          <div>

            <h1 className="text-5xl font-bold">
              Audit History
            </h1>

            <p className="text-zinc-400 mt-3">
              View all SEO audits.
            </p>

          </div>

          <Link
            href="/"
            className="rounded-xl bg-white text-black px-6 py-3 font-semibold"
          >
            ← Back Home
          </Link>

        </div>

        <DashboardCharts
          audits={audits}
          queueMetrics={queueMetrics}
        />

        <MonitoredWebsites
          onAuditCompleted={loadAudits}
        />

        {loading ? (

          <div
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-12"
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

          <div className="mt-12 rounded-2xl border border-zinc-800 bg-zinc-900 p-8">

            <h2 className="text-2xl font-semibold">
              No audits yet
            </h2>

          </div>

        ) : (

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-12">

            {audits.map((audit) => (

              <div
                key={audit.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
              >

                <div className="flex items-start justify-between gap-4">

                  <Link
                    href={`/audit/${audit.id}`}
                    className="flex-1"
                  >

                    <p className="text-zinc-400 text-sm">
                      Website
                    </p>

                    <h2 className="text-xl font-semibold mt-2 break-all">
                      {audit.url}
                    </h2>

                  </Link>

                  <button
                    onClick={() =>
                      handleDelete(
                        audit.id
                      )
                    }
                    aria-label={`Delete audit for ${audit.url}`}
                    title="Delete audit"
                    className="text-red-400 hover:text-red-300 text-xl"
                  >
                    ✕
                  </button>

                </div>

                <div className="grid grid-cols-3 gap-4 mt-8">

                  <div>

                    <p className="text-zinc-500 text-xs">
                      Score
                    </p>

                    <h3 className="text-3xl font-bold mt-1">
                      {audit.average_score}
                    </h3>

                  </div>

                  <div>

                    <p className="text-zinc-500 text-xs">
                      Pages
                    </p>

                    <h3 className="text-3xl font-bold mt-1">
                      {audit.total_pages}
                    </h3>

                  </div>

                  <div>

                    <p className="text-zinc-500 text-xs">
                      Issues
                    </p>

                    <h3 className="text-3xl font-bold mt-1">
                      {audit.total_issues}
                    </h3>

                  </div>

                </div>

                <p className="text-zinc-500 text-sm mt-8">
                  {formatLocalTimestamp(
                    audit.created_at
                  )}
                </p>

                {audit.ai_insights ? (

                  <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950 p-4 space-y-4">

                    <div>

                      <h3 className="text-sm font-semibold text-white">
                        AI Executive Summary
                      </h3>

                      <p className="text-sm text-zinc-400 mt-2">
                        {
                          audit.ai_insights
                            .executiveSummary
                        }
                      </p>

                    </div>

                    <div>

                      <h4 className="text-sm font-medium text-white">
                        Weekly Focus
                      </h4>

                      <p className="text-sm text-zinc-400 mt-2">
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

                        <h4 className="text-sm font-medium text-white mb-2">
                          Top Priorities
                        </h4>

                        <ul className="space-y-2 text-sm text-zinc-300">

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

                  <p className="mt-6 text-sm text-zinc-500">
                    AI insights not available for this audit.
                  </p>

                )}

              </div>

            ))}

          </div>

        )}

      </div>

    </main>

  )

}
