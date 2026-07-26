import Link from "next/link"
import type { Metadata } from "next"
import { supabase } from "@/lib/supabase"
import { formatLocalTimestamp } from "@/lib/date"
import {
  analyzeSeoRegression,
  RegressionAlert,
  RegressionHealthStatus
} from "@/utils/seoRegression"

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false
  }
}

type AuditRow = {
  id: string
  url: string
  average_score: number
  total_pages: number
  total_issues: number
  created_at: string
}

type CrawledPageRow = {
  id: string
  audit_id: string
  url: string
  title?: string | null
  meta_description?: string | null
  h1s?: string[] | null
  h2s?: string[] | null
  seo_score: number
  word_count: number
  issues?: string[] | null
  ai_recommendations?: string | null
}

function getStatusClasses(
  status: RegressionHealthStatus
) {
  if (status === "Improving") {
    return "border-green-500/20 bg-green-500/10 text-green-300"
  }

  if (status === "Warning") {
    return "border-orange-500/20 bg-orange-500/10 text-orange-300"
  }

  if (status === "Critical") {
    return "border-red-500/20 bg-red-500/10 text-red-300"
  }

  return "border-blue-500/20 bg-blue-500/10 text-blue-300"
}

function getAlertClasses(
  alert: RegressionAlert
) {
  if (alert.severity === "critical") {
    return "border-red-500/20 bg-red-500/10 text-red-200"
  }

  if (alert.severity === "warning") {
    return "border-orange-500/20 bg-orange-500/10 text-orange-200"
  }

  if (alert.severity === "positive") {
    return "border-green-500/20 bg-green-500/10 text-green-200"
  }

  return "border-zinc-700 bg-zinc-950 text-zinc-300"
}

function formatDelta(
  value: number | null
) {
  if (value === null) {
    return "Need more history"
  }

  if (value === 0) {
    return "No change"
  }

  return `${value > 0 ? "+" : ""}${value}`
}

function AlertCard({
  alert
}: {
  alert: RegressionAlert
}) {
  return (

    <div
      className={`rounded-xl border p-4 ${getAlertClasses(
        alert
      )}`}
    >

      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
        {alert.type}
      </p>

      <p className="mt-2 text-sm font-semibold leading-6">
        {alert.message}
      </p>

    </div>

  )
}

export default async function AuditDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {

  const { id } = await params

  const auditQuery =
    supabase
      .from("audits")
      .select(
        "id,url,average_score,total_pages,total_issues,created_at"
      )
      .eq("id", id)
      .single()

  const pagesQuery =
    supabase
      .from("crawled_pages")
      .select(
        "id,audit_id,url,title,meta_description,h1s,h2s,seo_score,word_count,issues,ai_recommendations"
      )
      .eq("audit_id", id)
      .order("seo_score", {
        ascending: false
      })
      .limit(25)

  const [
    { data: audit },
    { data: pages }
  ] =
    await Promise.all([
      auditQuery,
      pagesQuery
    ])

  const currentAudit =
    audit as AuditRow | null

  let previousAudit: AuditRow | null = null
  let previousPages: CrawledPageRow[] = []

  if (currentAudit) {

    const { data: previousAuditData } =
      await supabase
        .from("audits")
        .select(
          "id,url,average_score,total_pages,total_issues,created_at"
        )
        .eq("url", currentAudit.url)
        .lt(
          "created_at",
          currentAudit.created_at
        )
        .order("created_at", {
          ascending: false
        })
        .limit(1)
        .maybeSingle()

    previousAudit =
      previousAuditData as AuditRow | null

    if (previousAudit) {

      const { data: previousPagesData } =
        await supabase
          .from("crawled_pages")
          .select("issues")
          .eq(
            "audit_id",
            previousAudit.id
          )
          .limit(25)

      previousPages =
        (previousPagesData ||
          []) as CrawledPageRow[]

    }

  }

  const currentPages =
    (pages || []) as CrawledPageRow[]

  const regression =
    analyzeSeoRegression({
      currentAudit,
      previousAudit,
      currentPages,
      previousPages
    })

  return (

    <main className="min-h-screen bg-black text-white">

      <div className="max-w-7xl mx-auto px-6 py-10">

        <h1 className="text-5xl font-bold">
          Audit Details
        </h1>

        <p className="text-zinc-400 mt-3 break-all">
          {currentAudit?.url}
        </p>

        <div className="flex flex-wrap gap-4 mt-6">

          <Link
            href="/dashboard"
            className="rounded-xl bg-zinc-800 px-5 py-3"
          >
            ← Dashboard
          </Link>

          <Link
            href="/"
            className="rounded-xl bg-zinc-800 px-5 py-3"
          >
            🏠 Home
          </Link>

          <Link
            href={`/api/report/${id}`}
            className="rounded-xl bg-white text-black px-5 py-3 font-semibold"
          >
            Download PDF
          </Link>

        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

            <p className="text-zinc-400 text-sm">
              Average SEO Score
            </p>

            <h2 className="text-5xl font-bold mt-3">
              {currentAudit?.average_score}
            </h2>

          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

            <p className="text-zinc-400 text-sm">
              Pages Crawled
            </p>

            <h2 className="text-5xl font-bold mt-3">
              {currentAudit?.total_pages}
            </h2>

          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

            <p className="text-zinc-400 text-sm">
              Total Issues
            </p>

            <h2 className="text-5xl font-bold mt-3">
              {currentAudit?.total_issues}
            </h2>

          </div>

        </div>

        <section className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

            <div>

              <h2 className="text-3xl font-bold">
                Regression Summary
              </h2>

              <p className="text-zinc-400 mt-2 max-w-3xl">
                {regression.summary}
              </p>

              {previousAudit && (

                <p className="text-zinc-500 text-sm mt-3">
                  Compared with previous audit from{" "}
                  {formatLocalTimestamp(
                    previousAudit.created_at
                  )}
                </p>

              )}

            </div>

            <div
              className={`w-fit rounded-xl border px-4 py-3 text-sm font-semibold ${getStatusClasses(
                regression.status
              )}`}
            >
              {regression.status}
            </div>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">

            <div className="rounded-xl bg-zinc-950 p-4">
              <p className="text-zinc-500 text-sm">
                Score Change
              </p>
              <p className="text-2xl font-bold mt-2">
                {formatDelta(
                  regression.scoreDelta
                )}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-950 p-4">
              <p className="text-zinc-500 text-sm">
                Issue Change
              </p>
              <p className="text-2xl font-bold mt-2">
                {formatDelta(
                  regression.issueDelta
                )}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-950 p-4">
              <p className="text-zinc-500 text-sm">
                Page Count Change
              </p>
              <p className="text-2xl font-bold mt-2">
                {formatDelta(
                  regression.pagesDelta
                )}
              </p>
            </div>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-6">

            {regression.alerts.map(
              (alert, index) => (

                <AlertCard
                  key={`${alert.message}-${index}`}
                  alert={alert}
                />

              )
            )}

          </div>

        </section>

        <div className="mt-10 space-y-8">

          {currentPages.map((page) => (

            <div
              key={page.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden"
            >

              <div className="p-6 border-b border-zinc-800">

                <div className="flex items-center justify-between gap-6">

                  <div>

                    <h2 className="text-xl font-semibold break-all">
                      {page.url}
                    </h2>

                    <p className="text-zinc-500 mt-2">
                      {page.title}
                    </p>

                  </div>

                  <div className="text-right">

                    <p className="text-zinc-500 text-sm">
                      SEO Score
                    </p>

                    <h3 className="text-4xl font-bold">
                      {page.seo_score}
                    </h3>

                  </div>

                </div>

              </div>

              <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">

                <div className="space-y-6">

                  <div>

                    <p className="text-sm text-zinc-500 mb-2">
                      Meta Description
                    </p>

                    <div className="rounded-xl bg-zinc-950 p-4 text-zinc-300">
                      {page.meta_description ||
                        "No meta description"}
                    </div>

                  </div>

                  <div>

                    <p className="text-sm text-zinc-500 mb-2">
                      H1 Headings
                    </p>

                    <div className="space-y-2">

                      {page.h1s?.map(
                        (
                          heading: string,
                          index: number
                        ) => (

                          <div
                            key={index}
                            className="rounded-xl bg-zinc-950 p-3"
                          >
                            {heading}
                          </div>

                        )
                      )}

                    </div>

                  </div>

                  <div>

                    <p className="text-sm text-zinc-500 mb-2">
                      H2 Headings
                    </p>

                    <div className="space-y-2">

                      {page.h2s?.map(
                        (
                          heading: string,
                          index: number
                        ) => (

                          <div
                            key={index}
                            className="rounded-xl bg-zinc-950 p-3"
                          >
                            {heading}
                          </div>

                        )
                      )}

                    </div>

                  </div>

                </div>

                <div className="space-y-6">

                  <div>

                    <p className="text-sm text-zinc-500 mb-2">
                      SEO Issues
                    </p>

                    <div className="space-y-2">

                      {page.issues?.length === 0 ? (

                        <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-3 text-green-300">
                          No SEO issues detected
                        </div>

                      ) : (

                        page.issues?.map(
                          (
                            issue: string,
                            index: number
                          ) => (

                            <div
                              key={index}
                              className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-red-300"
                            >
                              {issue}
                            </div>

                          )
                        )

                      )}

                    </div>

                  </div>

                  <div>

                    <p className="text-sm text-zinc-500 mb-2">
                      AI Recommendations
                    </p>

                    <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-4 whitespace-pre-wrap text-blue-100">
                      {page.ai_recommendations}
                    </div>

                  </div>

                  <div>

                    <p className="text-sm text-zinc-500 mb-2">
                      Word Count
                    </p>

                    <div className="rounded-xl bg-zinc-950 p-4">
                      {page.word_count}
                    </div>

                  </div>

                </div>

              </div>

            </div>

          ))}

        </div>

      </div>

    </main>

  )

}
