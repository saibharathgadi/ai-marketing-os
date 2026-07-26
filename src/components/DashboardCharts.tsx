"use client"

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts"
import { formatLocalTimestamp } from "@/lib/date"
import {
  analyzeSeoRegression,
  getChronologicalRegressionAudits,
  RegressionAlert,
  RegressionHealthStatus
} from "@/utils/seoRegression"

type Audit = {
  id: string
  url: string
  average_score: number
  total_issues: number
  total_pages: number
  created_at: string
  crawl_duration_ms?: number | null
  crawl_failure_reason?: string | null
  crawl_status?: string | null
  is_slow?: boolean | null
}

type TrendPoint = {
  id: string
  label: string
  fullDate: string
  score: number
  issues: number
  pages: number
}

type QueueMetrics = {
  queued: number
  running: number
  failed: number
  failedByReason?: Record<string, number>
}

const axisColor = "#71717a"
const gridColor = "#27272f"
const scoreColor = "#60a5fa"
const issuesColor = "#f87171"
const pagesColor = "#34d399"

function getChartLabel(
  createdAt: string,
  index: number
) {
  const date = new Date(createdAt)

  if (Number.isNaN(date.getTime())) {
    return `Audit ${index + 1}`
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    timeZone:
      "Asia/Kolkata"
  }).format(date)
}

function buildTrendData(
  audits: Audit[]
) {
  return getChronologicalRegressionAudits(
    audits
  ).map((audit, index) => ({
    id: audit.id,
    label: getChartLabel(
      audit.created_at,
      index
    ),
    fullDate: formatLocalTimestamp(
      audit.created_at
    ),
    score:
      audit.average_score,
    issues:
      audit.total_issues,
    pages:
      audit.total_pages
  }))
}

function formatDelta(
  value: number | null,
  suffix = ""
) {
  if (value === null) {
    return "Need more history"
  }

  if (value === 0) {
    return `No change${suffix}`
  }

  const sign = value > 0 ? "+" : ""

  return `${sign}${value}${suffix}`
}

function formatDuration(
  durationMs: number | null | undefined
) {
  if (
    typeof durationMs !== "number" ||
    Number.isNaN(durationMs)
  ) {
    return "No data"
  }

  if (durationMs < 1000) {
    return `${durationMs}ms`
  }

  return `${(durationMs / 1000).toFixed(1)}s`
}

function getLatestFailure(
  audits: Audit[]
) {
  return audits.find(
    (audit) =>
      audit.crawl_status === "failed" ||
      Boolean(audit.crawl_failure_reason)
  )
}

function getAverageDurationMs(
  audits: Audit[]
) {
  const durations =
    audits
      .map((audit) => audit.crawl_duration_ms)
      .filter(
        (
          duration
        ): duration is number =>
          typeof duration === "number"
      )

  if (durations.length === 0) {
    return null
  }

  return Math.round(
    durations.reduce(
      (sum, duration) =>
        sum + duration,
      0
    ) / durations.length
  )
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

function TrendSummaryCard({
  label,
  value,
  detail
}: {
  label: string
  value: string
  detail: string
}) {
  return (

    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">

      <p className="text-zinc-500 text-sm">
        {label}
      </p>

      <h3 className="text-3xl font-bold mt-3">
        {value}
      </h3>

      <p className="text-zinc-500 text-sm mt-3">
        {detail}
      </p>

    </div>

  )
}

function AlertCard({
  alert
}: {
  alert: RegressionAlert
}) {
  return (

    <div
      className={`rounded-2xl border p-5 ${getAlertClasses(
        alert
      )}`}
    >

      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
        {alert.type}
      </p>

      <p className="mt-3 text-sm font-semibold leading-6">
        {alert.message}
      </p>

    </div>

  )
}

function QueueMetricCard({
  label,
  value,
  detail
}: {
  label: string
  value: number
  detail: string
}) {
  return (

    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">

      <p className="text-zinc-500 text-sm">
        {label}
      </p>

      <h3 className="text-3xl font-bold mt-3">
        {value}
      </h3>

      <p className="text-zinc-500 text-sm mt-3">
        {detail}
      </p>

    </div>

  )
}

function ChartPanel({
  title,
  dataKey,
  color,
  data
}: {
  title: string
  dataKey: "score" | "issues" | "pages"
  color: string
  data: TrendPoint[]
}) {
  return (

    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

      <h3 className="text-xl font-semibold">
        {title}
      </h3>

      <div className="mt-6 h-72 w-full">

        <ResponsiveContainer
          width="100%"
          height="100%"
        >
          <LineChart
            data={data}
            margin={{
              top: 8,
              right: 20,
              bottom: 8,
              left: 0
            }}
          >
            <CartesianGrid
              stroke={gridColor}
              strokeDasharray="3 3"
            />

            <XAxis
              dataKey="label"
              stroke={axisColor}
              tick={{
                fill: axisColor,
                fontSize: 12
              }}
            />

            <YAxis
              stroke={axisColor}
              tick={{
                fill: axisColor,
                fontSize: 12
              }}
              width={36}
            />

            <Tooltip
              contentStyle={{
                background:
                  "#09090b",
                border:
                  "1px solid #27272f",
                borderRadius:
                  "12px",
                color:
                  "#fafafa"
              }}
              labelFormatter={(
                _label,
                payload
              ) =>
                payload?.[0]?.payload
                  ?.fullDate || ""
              }
            />

            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={3}
              dot={{
                r: 4,
                fill: color,
                strokeWidth: 0
              }}
              activeDot={{
                r: 6
              }}
            />
          </LineChart>
        </ResponsiveContainer>

      </div>

    </div>

  )
}

export default function DashboardCharts({
  audits,
  queueMetrics = {
    queued: 0,
    running: 0,
    failed: 0,
    failedByReason: {}
  }
}: {
  audits: Audit[]
  queueMetrics?: QueueMetrics
}) {

  const chronologicalAudits =
    getChronologicalRegressionAudits(audits)
  const latestAudit =
    chronologicalAudits[
      chronologicalAudits.length - 1
    ]

  // Regression/trend comparisons only make sense within a single
  // website's own history — comparing the two most recent audits
  // site-wide would compare unrelated websites whenever more than one
  // site is monitored.
  const sameWebsiteAudits =
    latestAudit
      ? chronologicalAudits.filter(
          (audit) =>
            audit.url === latestAudit.url
        )
      : []
  const previousAudit =
    sameWebsiteAudits.length > 1
      ? sameWebsiteAudits[
          sameWebsiteAudits.length - 2
        ]
      : undefined
  const trendData =
    buildTrendData(sameWebsiteAudits)
  const regression =
    analyzeSeoRegression({
      currentAudit:
        latestAudit,
      previousAudit
    })
  const averageDurationMs =
    getAverageDurationMs(audits)
  const slowAuditCount =
    audits.filter(
      (audit) => audit.is_slow
    ).length
  const latestFailure =
    getLatestFailure(audits)
  const mostCommonQueueFailure =
    Object.entries(
      queueMetrics.failedByReason || {}
    ).sort((a, b) => b[1] - a[1])[0]

  return (

    <section className="mt-10">

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">

        <div>

          <h2 className="text-3xl font-bold">
            Historical Analytics
          </h2>

          <p className="text-zinc-400 mt-2 break-all">
            {latestAudit
              ? `Audit-to-audit SEO movement for ${latestAudit.url}, your most recently audited site.`
              : "Audit-to-audit SEO movement across saved reports."}
          </p>

        </div>

        <div
          className={`w-fit rounded-xl border px-4 py-3 text-sm font-semibold ${getStatusClasses(
            regression.status
          )}`}
        >
          {regression.status}
        </div>

      </div>

      {!regression.hasEnoughHistory && (

        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-zinc-400">
          Run at least two audits to unlock regression detection.
        </div>

      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mt-6">

        <TrendSummaryCard
          label="Latest SEO Score"
          value={
            latestAudit
              ? `${latestAudit.average_score}/100`
              : "No data"
          }
          detail={formatDelta(
            regression.scoreDelta,
            " since last audit"
          )}
        />

        <TrendSummaryCard
          label="Latest Issues"
          value={
            latestAudit
              ? String(
                  latestAudit.total_issues
                )
              : "No data"
          }
          detail={formatDelta(
            regression.issueDelta,
            " since last audit"
          )}
        />

        <TrendSummaryCard
          label="Pages Crawled"
          value={
            latestAudit
              ? String(
                  latestAudit.total_pages
                )
              : "No data"
          }
          detail={formatDelta(
            regression.pagesDelta,
            " since last audit"
          )}
        />

        <TrendSummaryCard
          label="Audit History"
          value={String(audits.length)}
          detail="Total audits tracked"
        />

      </div>

      <div className="mt-6">

        <div className="flex items-center justify-between gap-4 flex-wrap">

          <h3 className="text-2xl font-semibold">
            Crawl Diagnostics
          </h3>

          <p className="text-zinc-500 text-sm">
            Runtime health, duration, and failure signals.
          </p>

        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mt-4">

          <QueueMetricCard
            label="Running"
            value={queueMetrics.running}
            detail="Audits actively crawling"
          />

          <QueueMetricCard
            label="Queued"
            value={queueMetrics.queued}
            detail="Audits waiting for capacity"
          />

          <QueueMetricCard
            label="Failed"
            value={queueMetrics.failed}
            detail="Failed queue jobs in this warm instance"
          />

          <TrendSummaryCard
            label="Avg Crawl Time"
            value={formatDuration(
              averageDurationMs
            )}
            detail="Across loaded audit history"
          />

          <TrendSummaryCard
            label="Slow Websites"
            value={String(slowAuditCount)}
            detail="Audits above the slow crawl threshold"
          />

          <TrendSummaryCard
            label="Last Failure"
            value={
              latestFailure
                ?.crawl_failure_reason ||
              mostCommonQueueFailure?.[0] ||
              "None"
            }
            detail="Most recent persisted or queue failure"
          />

        </div>

      </div>

      <div className="mt-6">

        <div className="flex items-center justify-between gap-4 flex-wrap">

          <h3 className="text-2xl font-semibold">
            Regression Alerts
          </h3>

          <p className="text-zinc-500 text-sm">
            {regression.summary}
          </p>

        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">

          {regression.alerts
            .slice(0, 3)
            .map((alert, index) => (

              <AlertCard
                key={`${alert.message}-${index}`}
                alert={alert}
              />

            ))}

        </div>

      </div>

      {trendData.length > 0 && (

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">

          <ChartPanel
            title="SEO Score Trend"
            dataKey="score"
            color={scoreColor}
            data={trendData}
          />

          <ChartPanel
            title="Total Issues Trend"
            dataKey="issues"
            color={issuesColor}
            data={trendData}
          />

          <ChartPanel
            title="Pages Crawled Trend"
            dataKey="pages"
            color={pagesColor}
            data={trendData}
          />

        </div>

      )}

    </section>

  )

}
