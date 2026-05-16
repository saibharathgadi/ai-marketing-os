"use client"

import { useEffect, useState } from "react"
import { formatLocalTimestamp } from "@/lib/date"

type Website = {
  id: string
  url: string
  last_audited_at?: string
}

export default function MonitoredWebsites({
  onAuditCompleted
}: {
  onAuditCompleted: () => Promise<void>
}) {

  const [websites, setWebsites] =
    useState<Website[]>([])

  const [url, setUrl] =
    useState("")

  const [loading, setLoading] =
    useState(false)

  const [runningAudit, setRunningAudit] =
    useState<string | null>(null)

  useEffect(() => {

    loadWebsites()

  }, [])

  async function loadWebsites() {

    try {

      const response =
        await fetch(
          "/api/monitored-websites"
        )

      const result =
        await response.json()

      if (result.success) {

        setWebsites(result.data)

      }

    } catch (error) {

      console.error(error)

    }

  }

  async function handleAddWebsite() {

    if (!url.trim()) return

    setLoading(true)

    try {

      let normalizedUrl =
        url.trim()

      if (
        !normalizedUrl.startsWith(
          "http://"
        ) &&
        !normalizedUrl.startsWith(
          "https://"
        )
      ) {

        normalizedUrl =
          `https://${normalizedUrl}`

      }

      const response =
        await fetch(
          "/api/monitored-websites",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({
              url: normalizedUrl
            })
          }
        )

      const result =
        await response.json()

      if (!result.success) return

      setWebsites((prev) => [
        result.data,
        ...prev
      ])

      setUrl("")

    } catch (error) {

      console.error(error)

    } finally {

      setLoading(false)

    }

  }

  async function handleDelete(
    id: string
  ) {

    const confirmed =
      confirm(
        "Delete monitored website?"
      )

    if (!confirmed) return

    try {

      const response =
        await fetch(
          `/api/monitored-websites/${id}`,
          {
            method: "DELETE"
          }
        )

      const result =
        await response.json()

      if (!result.success) return

      setWebsites((prev) =>
        prev.filter(
          (website) =>
            website.id !== id
        )
      )

    } catch (error) {

      console.error(error)

    }

  }

  async function handleRunAudit(
    websiteUrl: string
  ) {

    try {

      setRunningAudit(websiteUrl)

      const response =
        await fetch("/api/analyze", {

          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            url: websiteUrl
          })

        })

      const result =
        await response.json()

      if (!result.success) {

        alert(
          "Audit failed."
        )

        return

      }

      await loadWebsites()

      await onAuditCompleted()

      alert(
        "Audit completed successfully."
      )

    } catch (error) {

      console.error(error)

      alert(
        "Failed to run audit."
      )

    } finally {

      setRunningAudit(null)

    }

  }

  async function handleRunScheduledAudits() {

    try {

      setLoading(true)

      await fetch(
        "/api/run-scheduled-audits"
      )

      await loadWebsites()

      await onAuditCompleted()

      alert(
        "Scheduled audits completed."
      )

    } catch {

      alert(
        "Failed to run scheduled audits."
      )

    } finally {

      setLoading(false)

    }

  }

  return (

    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 mt-10">

      <div className="flex items-center justify-between gap-4 flex-wrap">

        <div>

          <h2 className="text-3xl font-bold">
            Monitored Websites
          </h2>

          <p className="text-zinc-400 mt-2">
            Save websites for recurring audits.
          </p>

        </div>

        <button
          onClick={
            handleRunScheduledAudits
          }
          disabled={loading}
          className="rounded-xl bg-blue-600 px-6 py-3 font-semibold disabled:opacity-50"
        >

          {loading
            ? "Running..."
            : "Run Scheduled Audits"}

        </button>

      </div>

      <div className="flex flex-col md:flex-row gap-4 mt-8">

        <input
          type="text"
          placeholder="https://example.com"
          value={url}
          onChange={(e) =>
            setUrl(e.target.value)
          }
          className="flex-1 rounded-xl bg-black border border-zinc-700 px-5 py-4 outline-none"
        />

        <button
          onClick={handleAddWebsite}
          disabled={loading}
          className="rounded-xl bg-white text-black px-6 py-4 font-semibold disabled:opacity-50"
        >

          {loading
            ? "Saving..."
            : "Save Website"}

        </button>

      </div>

      <div className="space-y-4 mt-8">

        {websites.length === 0 ? (

          <div className="rounded-xl bg-zinc-950 p-5 text-zinc-400">
            No monitored websites yet.
          </div>

        ) : (

          websites.map((website) => (

            <div
              key={website.id}
              className="rounded-xl bg-zinc-950 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
            >

              <div>

                <p className="text-zinc-400 text-sm">
                  Website
                </p>

                <h3 className="text-lg font-semibold break-all mt-1">
                  {website.url}
                </h3>

                <p className="text-zinc-500 text-sm mt-2">

                  Last audited:
                  {" "}

                  {formatLocalTimestamp(
                    website.last_audited_at
                  )}

                </p>

              </div>

              <div className="flex gap-3">

                <button
                  onClick={() =>
                    handleRunAudit(
                      website.url
                    )
                  }
                  disabled={
                    runningAudit ===
                    website.url
                  }
                  className="rounded-xl bg-green-600 px-5 py-3 font-semibold disabled:opacity-50"
                >

                  {runningAudit ===
                  website.url
                    ? "Auditing..."
                    : "Run Audit"}

                </button>

                <button
                  onClick={() =>
                    handleDelete(
                      website.id
                    )
                  }
                  className="rounded-xl bg-red-600 px-5 py-3 font-semibold"
                >
                  Delete
                </button>

              </div>

            </div>

          ))

        )}

      </div>

    </div>

  )

}
