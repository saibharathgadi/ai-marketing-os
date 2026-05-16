"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from "recharts"

type Audit = {
  id: string
  average_score: number
  total_issues: number
  created_at: string
}

export default function DashboardCharts({
  audits
}: {
  audits: Audit[]
}) {

  const chartData =
    audits
      .slice()
      .reverse()
      .map((audit, index) => ({

        name: `Audit ${index + 1}`,

        score:
          audit.average_score,

        issues:
          audit.total_issues

      }))

  return (

    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-10">

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 overflow-x-auto">

        <h2 className="text-2xl font-semibold mb-6">
          SEO Score Trend
        </h2>

        <LineChart
          width={500}
          height={300}
          data={chartData}
        >

          <CartesianGrid strokeDasharray="3 3" />

          <XAxis dataKey="name" />

          <YAxis />

          <Tooltip />

          <Line
            type="monotone"
            dataKey="score"
            stroke="#ffffff"
            strokeWidth={3}
          />

        </LineChart>

      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 overflow-x-auto">

        <h2 className="text-2xl font-semibold mb-6">
          SEO Issues Trend
        </h2>

        <LineChart
          width={500}
          height={300}
          data={chartData}
        >

          <CartesianGrid strokeDasharray="3 3" />

          <XAxis dataKey="name" />

          <YAxis />

          <Tooltip />

          <Line
            type="monotone"
            dataKey="issues"
            stroke="#ffffff"
            strokeWidth={3}
          />

        </LineChart>

      </div>

    </div>

  )

}