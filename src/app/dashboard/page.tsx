"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { formatLocalTimestamp } from "@/lib/date"
import DashboardCharts from "@/components/DashboardCharts"
import MonitoredWebsites from "@/components/MonitoredWebsites"

type Audit = {
  id: string
  url: string
  average_score: number
  total_pages: number
  total_issues: number
  created_at: string
}

export default function DashboardPage() {

  const [audits, setAudits] =
    useState<Audit[]>([])

  const [loading, setLoading] =
    useState(true)

  useEffect(() => {

    loadAudits()

  }, [])

  async function loadAudits() {

    try {

      const { data, error } =
        await supabase
          .from("audits")
          .select("*")
          .order("created_at", {
            ascending: false
          })

      if (error) {

        console.error(error)

        return

      }

      setAudits(data || [])

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

        {audits.length > 0 && (

          <DashboardCharts audits={audits} />

        )}

        <MonitoredWebsites
          onAuditCompleted={loadAudits}
        />

        {loading ? (

          <div className="mt-12 text-zinc-400">
            Loading audits...
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

              </div>

            ))}

          </div>

        )}

      </div>

    </main>

  )

}
