import { supabase } from "@/lib/supabase"
import { enqueueAudit } from "./auditQueue"
import { updateMonitoredWebsiteDiagnostics } from "./monitoredWebsiteDiagnostics"
import { generateAndPersistAuditInsights } from "./aiCopilot"
import { analyzeSeoRegression } from "./seoRegression"
import { sendSeoRegressionAlertEmail } from "./emailReport"
import { isMissingColumnError } from "./schemaCompat"

type MonitoredWebsiteRow = {
  id: string
  url: string
  notification_email?: string | null
}

const auditHistorySelect =
  "id,url,average_score,total_pages,total_issues,created_at"

/**
 * Sends a regression alert email for the given monitored website when
 * its two most recent audits show a Warning/Critical regression. Kept
 * best-effort: a notification failure must never be reported as the
 * audit itself having failed.
 */
async function notifyIfRegressed(
  website: MonitoredWebsiteRow
) {
  if (!website.notification_email) {
    return
  }

  try {

    const { data: recentAudits } =
      await supabase
        .from("audits")
        .select(auditHistorySelect)
        .eq("url", website.url)
        .order("created_at", {
          ascending: false
        })
        .limit(2)

    const [currentAudit, previousAudit] =
      recentAudits || []

    if (!currentAudit) {
      return
    }

    const regression =
      analyzeSeoRegression({
        currentAudit,
        previousAudit
      })

    if (
      regression.status !== "Critical" &&
      regression.status !== "Warning"
    ) {
      return
    }

    const emailResult =
      await sendSeoRegressionAlertEmail({
        to: website.notification_email,
        audit: currentAudit,
        regression
      })

    if (!emailResult.success) {
      console.error(
        "Failed to send regression alert email:",
        emailResult.error
      )
    }

  } catch (error) {

    console.error(
      "Failed to evaluate regression alert:",
      error
    )

  }
}

type MonitoredWebsiteAuditResult = {
  website: string
  success: boolean
  status?: string
  error?: string
  failureReason?: string | null
  durationMs?: number
  isSlow?: boolean
}

export type RunMonitoredWebsiteAuditsResult =
  | {
      success: true
      total: number
      results: MonitoredWebsiteAuditResult[]
    }
  | {
      success: false
      error: string
    }

/**
 * Runs an audit for every saved monitored website. Shared by the
 * cron-secret-protected scheduled endpoint and the interactive
 * "Run Scheduled Audits" dashboard button, so the two call sites can't
 * drift out of sync with each other.
 */
export async function runMonitoredWebsiteAudits(): Promise<RunMonitoredWebsiteAuditsResult> {

  let { data: websites, error } =
    await supabase
      .from("monitored_websites")
      .select("id,url,notification_email")

  if (
    error &&
    isMissingColumnError(
      error.message,
      ["notification_email"]
    )
  ) {
    ({ data: websites, error } =
      await supabase
        .from("monitored_websites")
        .select("id,url"))
  }

  if (error) {
    return {
      success: false,
      error: error.message
    }
  }

  const results: MonitoredWebsiteAuditResult[] = []

  for (const website of websites || []) {

    try {

      console.log(
        "Running scheduled audit:",
        website.url
      )

      const auditResult =
        await enqueueAudit(website.url)

      if (auditResult.success) {
        await generateAndPersistAuditInsights(
          auditResult.data
        )

        await notifyIfRegressed(website)
      }

      await updateMonitoredWebsiteDiagnostics({
        id: website.id,
        url: website.url,
        success: auditResult.success,
        failureReason:
          auditResult.success
            ? auditResult.data.failureReason
            : auditResult.failureReason,
        durationMs:
          auditResult.success
            ? auditResult.data.durationMs
            : auditResult.durationMs,
        isSlow:
          auditResult.success
            ? auditResult.data.isSlow
            : false
      })

      results.push({
        website: website.url,
        success: auditResult.success,
        status: auditResult.status,
        error:
          auditResult.success
            ? undefined
            : auditResult.error,
        failureReason:
          auditResult.success
            ? auditResult.data.failureReason
            : auditResult.failureReason,
        durationMs:
          auditResult.success
            ? auditResult.data.durationMs
            : auditResult.durationMs,
        isSlow:
          auditResult.success
            ? auditResult.data.isSlow
            : false
      })

    } catch (error) {

      console.error(error)

      results.push({
        website: website.url,
        success: false
      })

    }

  }

  return {
    success: true,
    total: websites?.length || 0,
    results
  }

}
