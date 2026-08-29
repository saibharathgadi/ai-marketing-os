import Link from "next/link"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { formatLocalTimestamp } from "@/lib/date"
import {
  analyzeSeoRegression,
  RegressionAlert,
  RegressionHealthStatus
} from "@/utils/seoRegression"
import AuditCopilotTabs, {
  type AIInsights
} from "@/components/AuditCopilotTabs"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import StatCard from "@/components/StatCard"

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false
  }
}

type EngineScore = {
  score: number
  issues: string[]
}

type TechnicalSeo = {
  aeo?: EngineScore
  aio?: EngineScore
  geo?: EngineScore
} | null

type AuditRow = {
  id: string
  url: string
  org_id: string | null
  average_score: number
  total_pages: number
  total_issues: number
  created_at: string
  technical_seo?: TechnicalSeo
  ai_insights?: Record<string, unknown> | null
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
    return "border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-300"
  }

  if (status === "Warning") {
    return "border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-300"
  }

  if (status === "Critical") {
    return "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300"
  }

  return "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300"
}

function getAlertClasses(
  alert: RegressionAlert
) {
  if (alert.severity === "critical") {
    return "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300"
  }

  if (alert.severity === "warning") {
    return "border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-300"
  }

  if (alert.severity === "positive") {
    return "border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-300"
  }

  return "border-border bg-background text-foreground"
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

  const supabase = await createClient()

  // RLS restricts every query below to audits/pages in organizations
  // the current session's user belongs to — plus a separate policy
  // (see the anon_teaser_audits migration) that lets anyone read back
  // org-less teaser audits specifically.
  const auditQuery =
    supabase
      .from("audits")
      .select(
        "id,url,org_id,average_score,total_pages,total_issues,created_at,technical_seo,ai_insights"
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
    { data: pages },
    { data: { user } }
  ] =
    await Promise.all([
      auditQuery,
      pagesQuery,
      supabase.auth.getUser()
    ])

  const currentAudit =
    audit as AuditRow | null

  const isAnonymousViewer = !user
  const isTeaserAudit =
    currentAudit?.org_id === null

  // An anonymous viewer hitting a private (org-owned) audit link, or a
  // nonexistent one — RLS already returned null above for the private
  // case, so this can't leak org data, it just needs friendlier UI than
  // a blank page.
  if (
    isAnonymousViewer &&
    !isTeaserAudit
  ) {

    return (

      <main className="relative min-h-screen bg-background text-foreground flex items-center justify-center overflow-hidden">

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[image:var(--gradient-glow)]"
        />

        <Card className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center">

          <h1 className="text-2xl font-bold">
            Log in to view this audit
          </h1>

          <p className="text-muted-foreground mt-3">
            This audit is private. Log in to the account it belongs to
            in order to view it.
          </p>

          <Button asChild size="lg" className="mt-6 w-full h-auto py-3">
            <Link href="/login">
              Log in
            </Link>
          </Button>

        </Card>

      </main>

    )

  }

  let previousAudit: AuditRow | null = null
  let previousPages: CrawledPageRow[] = []

  if (currentAudit && !isTeaserAudit) {

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

    <main className="min-h-screen bg-background text-foreground">

      <div className="max-w-7xl mx-auto px-6 py-10">

        <div className="flex flex-wrap items-start justify-between gap-6">

          <div>

            <Link
              href={isTeaserAudit ? "/" : "/dashboard"}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition"
            >
              {isTeaserAudit ? "← Back to Home" : "← Back to Dashboard"}
            </Link>

            <h1 className="text-4xl font-bold mt-3">
              {isTeaserAudit ? "Preview Audit" : "Audit Details"}
            </h1>

            <p className="text-muted-foreground mt-2 break-all">
              {currentAudit?.url}
            </p>

          </div>

          {!isTeaserAudit && (

            <div className="flex gap-3">

              <Button asChild size="lg" className="h-auto py-3 px-6">
                <Link href={`/api/report/${id}`}>
                  Download PDF
                </Link>
              </Button>

              <Button asChild variant="outline" size="lg" className="h-auto py-3 px-6">
                <Link href={`/api/report/${id}/llms-txt`}>
                  Download llms.txt
                </Link>
              </Button>

            </div>

          )}

        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 mt-10">

          <StatCard
            label="SEO"
            value={currentAudit?.average_score ?? "—"}
          />

          <StatCard
            label="AEO"
            value={
              typeof currentAudit?.technical_seo?.aeo?.score === "number"
                ? currentAudit.technical_seo.aeo.score
                : "—"
            }
            subtext={!currentAudit?.technical_seo?.aeo ? "Not yet analyzed" : undefined}
          />

          <StatCard
            label="AIO"
            value={
              typeof currentAudit?.technical_seo?.aio?.score === "number"
                ? currentAudit.technical_seo.aio.score
                : "—"
            }
            subtext={!currentAudit?.technical_seo?.aio ? "Not yet analyzed" : undefined}
          />

          <StatCard
            label="GEO"
            value={
              typeof currentAudit?.technical_seo?.geo?.score === "number"
                ? currentAudit.technical_seo.geo.score
                : "—"
            }
            subtext={!currentAudit?.technical_seo?.geo ? "Not yet analyzed" : undefined}
          />

          <StatCard
            label="Pages Crawled"
            value={currentAudit?.total_pages ?? "—"}
          />

          <StatCard
            label="Total Issues"
            value={currentAudit?.total_issues ?? "—"}
          />

        </div>

        {isTeaserAudit && (

          <Card className="mt-10 rounded-2xl border border-violet-500/20 bg-violet-500/10 p-8 text-center">

            <h2 className="text-2xl font-bold">
              This is a preview
            </h2>

            <p className="text-muted-foreground mt-2 max-w-xl mx-auto">
              You&apos;re seeing {currentAudit?.total_pages ?? "a"} crawled
              page{currentAudit?.total_pages === 1 ? "" : "s"}. Log in or
              sign up to run a full multi-page audit with AI-generated
              content, campaign, and roadmap recommendations.
            </p>

            <Button asChild size="lg" className="mt-6 h-auto py-3 px-8">
              <Link
                href={`/login?next=${encodeURIComponent(
                  `/?url=${encodeURIComponent(currentAudit?.url ?? "")}`
                )}`}
              >
                Log in for full audit
              </Link>
            </Button>

          </Card>

        )}

        {!isTeaserAudit && (

        <section className="mt-10 rounded-2xl border border-border bg-card p-6">

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

            <div>

              <h2 className="text-3xl font-bold">
                Regression Summary
              </h2>

              <p className="text-muted-foreground mt-2 max-w-3xl">
                {regression.summary}
              </p>

              {previousAudit && (

                <p className="text-muted-foreground text-sm mt-3">
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

            <div className="rounded-xl bg-background p-4">
              <p className="text-muted-foreground text-sm">
                Score Change
              </p>
              <p className="text-2xl font-bold mt-2">
                {formatDelta(
                  regression.scoreDelta
                )}
              </p>
            </div>

            <div className="rounded-xl bg-background p-4">
              <p className="text-muted-foreground text-sm">
                Issue Change
              </p>
              <p className="text-2xl font-bold mt-2">
                {formatDelta(
                  regression.issueDelta
                )}
              </p>
            </div>

            <div className="rounded-xl bg-background p-4">
              <p className="text-muted-foreground text-sm">
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

        )}

        {currentAudit?.ai_insights && (

          <AuditCopilotTabs
            aiInsights={currentAudit.ai_insights as AIInsights}
            auditId={currentAudit.id}
            siteUrl={currentAudit.url}
          />

        )}

        <div className="mt-10 space-y-8">

          {currentPages.map((page) => (

            <div
              key={page.id}
              className="rounded-2xl border border-border bg-card overflow-hidden"
            >

              <div className="p-6 border-b border-border">

                <div className="flex items-center justify-between gap-6">

                  <div>

                    <h2 className="text-xl font-semibold break-all">
                      {page.url}
                    </h2>

                    <p className="text-muted-foreground mt-2">
                      {page.title}
                    </p>

                  </div>

                  <div className="text-right">

                    <p className="text-muted-foreground text-sm">
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

                    <p className="text-sm text-muted-foreground mb-2">
                      Meta Description
                    </p>

                    <div className="rounded-xl bg-background p-4 text-foreground">
                      {page.meta_description ||
                        "No meta description"}
                    </div>

                  </div>

                  <div>

                    <p className="text-sm text-muted-foreground mb-2">
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
                            className="rounded-xl bg-background p-3"
                          >
                            {heading}
                          </div>

                        )
                      )}

                    </div>

                  </div>

                  {page.h2s && page.h2s.length > 0 && (

                    <div>

                      <p className="text-sm text-muted-foreground mb-2">
                        H2 Headings
                      </p>

                      <div className="space-y-2">

                        {page.h2s.map(
                          (
                            heading: string,
                            index: number
                          ) => (

                            <div
                              key={index}
                              className="rounded-xl bg-background p-3"
                            >
                              {heading}
                            </div>

                          )
                        )}

                      </div>

                    </div>

                  )}

                </div>

                <div className="space-y-6">

                  <div>

                    <p className="text-sm text-muted-foreground mb-2">
                      SEO Issues
                    </p>

                    <div className="space-y-2">

                      {page.issues?.length === 0 ? (

                        <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-3 text-green-700 dark:text-green-300">
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
                              className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-red-700 dark:text-red-300"
                            >
                              {issue}
                            </div>

                          )
                        )

                      )}

                    </div>

                  </div>

                  {page.ai_recommendations && (

                    <div>

                      <p className="text-sm text-muted-foreground mb-2">
                        AI Recommendations
                      </p>

                      <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-4 whitespace-pre-wrap text-blue-700 dark:text-blue-300">
                        {page.ai_recommendations}
                      </div>

                    </div>

                  )}

                  <div>

                    <p className="text-sm text-muted-foreground mb-2">
                      Word Count
                    </p>

                    <div className="rounded-xl bg-background p-4">
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
