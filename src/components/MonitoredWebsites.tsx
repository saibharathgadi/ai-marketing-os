"use client"

import { useEffect, useState } from "react"
import { formatLocalTimestamp } from "@/lib/date"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

type Website = {
  id: string
  url: string
  last_audited_at?: string
  last_failure_reason?: string | null
  last_audit_duration_ms?: number | null
  last_audit_status?: string | null
  last_audit_is_slow?: boolean | null
  notification_email?: string | null
}

function formatDuration(
  durationMs: number | null | undefined
) {
  if (
    typeof durationMs !== "number" ||
    Number.isNaN(durationMs)
  ) {
    return "No duration yet"
  }

  if (durationMs < 1000) {
    return `${durationMs}ms`
  }

  return `${(durationMs / 1000).toFixed(1)}s`
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

  const [notificationEmail, setNotificationEmail] =
    useState("")

  const [loading, setLoading] =
    useState(false)

  const [runningAudit, setRunningAudit] =
    useState<string | null>(null)

  const [statusMessage, setStatusMessage] =
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
              url: normalizedUrl,
              notificationEmail:
                notificationEmail.trim() ||
                undefined
            })
          }
        )

      const result =
        await response.json()

      if (!result.success) {
        setStatusMessage(
          result.error ||
            "Failed to save website."
        )

        return
      }

      setWebsites((prev) => [
        result.data,
        ...prev
      ])

      setUrl("")
      setNotificationEmail("")
      setStatusMessage(
        "Website saved."
      )

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

      if (!result.success) {
        setStatusMessage(
          result.error ||
            "Failed to delete website."
        )

        return
      }

      setWebsites((prev) =>
        prev.filter(
          (website) =>
            website.id !== id
        )
      )

      setStatusMessage(
        "Website removed."
      )

    } catch (error) {

      console.error(error)

    }

  }

  async function handleRunAudit(
    websiteId: string,
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
            url: websiteUrl,
            websiteId
          })

        })

      const result =
        await response.json()

      if (!result.success) {

        setStatusMessage(
          result.error ||
            "Audit failed."
        )

        return

      }

      await loadWebsites()

      await onAuditCompleted()

      setStatusMessage(
        "Audit completed successfully."
      )

    } catch (error) {

      console.error(error)

      setStatusMessage(
        "Failed to run audit."
      )

    } finally {

      setRunningAudit(null)

    }

  }

  async function handleRunScheduledAudits() {

    try {

      setLoading(true)

      const response =
        await fetch(
          "/api/monitored-websites/run-all",
          {
            method: "POST"
          }
        )

      const result =
        await response.json()

      if (!result.success) {
        setStatusMessage(
          result.error ||
            "Failed to run scheduled audits."
        )

        return
      }

      await loadWebsites()

      await onAuditCompleted()

      const failedCount =
        result.results?.filter(
          (item: { success: boolean }) =>
            !item.success
        ).length || 0

      setStatusMessage(
        failedCount > 0
          ? `Scheduled audits completed with ${failedCount} skipped or failed.`
          : "Scheduled audits completed."
      )

    } catch {

      setStatusMessage(
        "Failed to run scheduled audits."
      )

    } finally {

      setLoading(false)

    }

  }

  return (

    <Card className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 mt-10">

      <div className="flex items-center justify-between gap-4 flex-wrap">

        <div>

          <h2 className="text-3xl font-bold">
            Monitored Websites
          </h2>

          <p className="text-zinc-400 mt-2">
            Save websites for recurring audits.
          </p>

        </div>

        <Button
          onClick={
            handleRunScheduledAudits
          }
          disabled={loading}
          size="lg"
          className="h-auto py-3 px-6"
        >

          {loading
            ? "Running…"
            : "Run Scheduled Audits"}

        </Button>

      </div>

      <div className="flex flex-col md:flex-row gap-4 mt-8">

        <input
          type="text"
          placeholder="https://example.com"
          value={url}
          onChange={(e) =>
            setUrl(e.target.value)
          }
          className="flex-1 rounded-xl bg-black border border-zinc-700 px-5 py-4 outline-none focus:border-violet-500"
        />

        <input
          type="email"
          placeholder="Notification email (optional)"
          value={notificationEmail}
          onChange={(e) =>
            setNotificationEmail(
              e.target.value
            )
          }
          className="flex-1 rounded-xl bg-black border border-zinc-700 px-5 py-4 outline-none focus:border-violet-500"
        />

        <Button
          onClick={handleAddWebsite}
          disabled={loading}
          variant="outline"
          size="lg"
          className="h-auto py-4 px-6"
        >

          {loading
            ? "Saving…"
            : "Save Website"}

        </Button>

      </div>

      <p className="text-zinc-500 text-sm mt-3">
        If a notification email is set, you&apos;ll get an alert when a scheduled audit detects a warning or critical SEO regression.
      </p>

      {statusMessage && (

        <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">
          {statusMessage}
        </div>

      )}

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

                <div className="mt-3 flex flex-wrap gap-2 text-xs">

                  <span className="rounded-lg bg-zinc-900 px-3 py-2 text-zinc-400">
                    Duration:{" "}
                    {formatDuration(
                      website.last_audit_duration_ms
                    )}
                  </span>

                  {website.last_audit_is_slow && (

                    <span className="rounded-lg bg-orange-500/10 px-3 py-2 text-orange-300">
                      Slow website
                    </span>

                  )}

                  {website.last_failure_reason && (

                    <span className="rounded-lg bg-red-500/10 px-3 py-2 text-red-300">
                      Last failure:{" "}
                      {website.last_failure_reason}
                    </span>

                  )}

                  {website.notification_email && (

                    <span className="rounded-lg bg-blue-500/10 px-3 py-2 text-blue-300">
                      Alerts:{" "}
                      {website.notification_email}
                    </span>

                  )}

                </div>

              </div>

              <div className="flex gap-3">

                <Button
                  onClick={() =>
                    handleRunAudit(
                      website.id,
                      website.url
                    )
                  }
                  disabled={
                    runningAudit ===
                    website.url
                  }
                  variant="outline"
                  className="h-auto py-3 px-5"
                >

                  {runningAudit ===
                  website.url
                    ? "Auditing…"
                    : "Run Audit"}

                </Button>

                <Button
                  onClick={() =>
                    handleDelete(
                      website.id
                    )
                  }
                  variant="destructive"
                  className="h-auto py-3 px-5"
                >
                  Delete
                </Button>

              </div>

            </div>

          ))

        )}

      </div>

    </Card>

  )

}
