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

type Audit = {
  id: string
  average_score: number
  total_issues: number
  total_pages: number
  created_at: string
}

type HealthStatus =
  | "Improving"
  | "Stable"
  | "Declining"
  | "Critical"

type TrendPoint = {
  id: string
  label: string
  fullDate: string
  score: number
  issues: number
  pages: number
}

const axisColor = "#71717a"
const gridColor = "#27272f"
const scoreColor = "#60a5fa"
const issuesColor = "#f87171"
const pagesColor = "#34d399"

function getChronologicalAudits(
  audits: Audit[]
) {
  return [...audits].sort(
    (a, b) =>
      new Date(a.created_at).getTime() -
      new Date(b.created_at).getTime()
  )
}

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
  return getChronologicalAudits(audits).map(
    (audit, index) => ({
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
    })
  )
}

function getDelta(
  current: number,
  previous: number | null
) {
  if (previous === null) {
    return null
  }

  return current - previous
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

function getHealthStatus(
  latest: TrendPoint | undefined,
  previous: TrendPoint | undefined
): HealthStatus {
  if (!latest) {
    return "Stable"
  }

  if (
    latest.score < 55 ||
    latest.issues >= 25
  ) {
    return "Critical"
  }

  if (!previous) {
    return "Stable"
  }

  const scoreDelta =
    latest.score - previous.score
  const issueDelta =
    latest.issues - previous.issues

  if (
    scoreDelta >= 5 &&
    issueDelta <= 0
  ) {
    return "Improving"
  }

  if (
    scoreDelta <= -5 ||
    issueDelta >= 5
  ) {
    return "Declining"
  }

  return "Stable"
}

function getStatusClasses(
  status: HealthStatus
) {
  if (status === "Improving") {
    return "border-green-500/20 bg-green-500/10 text-green-300"
  }

  if (status === "Declining") {
    return "border-orange-500/20 bg-orange-500/10 text-orange-300"
  }

  if (status === "Critical") {
    return "border-red-500/20 bg-red-500/10 text-red-300"
  }

  return "border-blue-500/20 bg-blue-500/10 text-blue-300"
}

function getTrendSummary(
  trendData: TrendPoint[]
) {
  const latest =
    trendData[trendData.length - 1]
  const previous =
    trendData.length > 1
      ? trendData[trendData.length - 2]
      : undefined

  const scoreDelta =
    latest && previous
      ? getDelta(
          latest.score,
          previous.score
        )
      : null

  const issuesDelta =
    latest && previous
      ? getDelta(
          latest.issues,
          previous.issues
        )
      : null

  const pagesDelta =
    latest && previous
      ? getDelta(
          latest.pages,
          previous.pages
        )
      : null

  return {
    latest,
    previous,
    scoreDelta,
    issuesDelta,
    pagesDelta,
    status: getHealthStatus(
      latest,
      previous
    )
  }
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
  audits
}: {
  audits: Audit[]
}) {

  const trendData =
    buildTrendData(audits)

  const {
    latest,
    scoreDelta,
    issuesDelta,
    pagesDelta,
    status
  } = getTrendSummary(trendData)

  return (

    <section className="mt-10">

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">

        <div>

          <h2 className="text-3xl font-bold">
            Historical Analytics
          </h2>

          <p className="text-zinc-400 mt-2">
            Audit-to-audit SEO movement across saved reports.
          </p>

        </div>

        <div
          className={`w-fit rounded-xl border px-4 py-3 text-sm font-semibold ${getStatusClasses(
            status
          )}`}
        >
          {status}
        </div>

      </div>

      {trendData.length < 2 && (

        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-zinc-400">
          Run at least two audits to unlock full trend comparison.
        </div>

      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mt-6">

        <TrendSummaryCard
          label="Latest SEO Score"
          value={
            latest
              ? `${latest.score}/100`
              : "No data"
          }
          detail={formatDelta(
            scoreDelta,
            " since last audit"
          )}
        />

        <TrendSummaryCard
          label="Latest Issues"
          value={
            latest
              ? String(latest.issues)
              : "No data"
          }
          detail={formatDelta(
            issuesDelta,
            " since last audit"
          )}
        />

        <TrendSummaryCard
          label="Pages Crawled"
          value={
            latest
              ? String(latest.pages)
              : "No data"
          }
          detail={formatDelta(
            pagesDelta,
            " since last audit"
          )}
        />

        <TrendSummaryCard
          label="Audit History"
          value={String(audits.length)}
          detail="Total audits tracked"
        />

      </div>

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

    </section>

  )

}
