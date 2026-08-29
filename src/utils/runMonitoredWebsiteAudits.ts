import { createServiceClient } from "@/lib/supabase/service"
import { enqueueAudit } from "./auditQueue"
import { updateMonitoredWebsiteDiagnostics } from "./monitoredWebsiteDiagnostics"
import { generateAndPersistAuditInsights } from "./aiCopilot"
import { analyzeSeoRegression } from "./seoRegression"
import { sendSeoRegressionAlertEmail } from "./emailReport"
import { isMissingColumnError } from "./schemaCompat"
import { getOrgPlanAndName } from "./organizations"
import { checkInternalUsageAndAlert } from "./internalUsageMonitor"

type MonitoredWebsiteRow = {
  id: string
  url: string
  org_id: string
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
  supabase: ReturnType<typeof createServiceClient>,
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
        .eq("org_id", website.org_id)
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
 * Runs an audit for every saved monitored website, optionally scoped to
 * one organization. Shared by the cron-secret-protected scheduled
 * endpoint (no orgId — sweeps every organization) and the interactive
 * "Run Scheduled Audits" dashboard button (orgId — only that user's own
 * organization), so the two call sites can't drift out of sync.
 *
 * Uses the service-role client throughout: this is trusted system code
 * that already had its caller's authorization checked (session + org
 * membership for the button, CRON_SECRET for the scheduler) before
 * being invoked, so it intentionally bypasses RLS rather than needing
 * a session token threaded through the whole crawl pipeline.
 */
export async function runMonitoredWebsiteAudits(
  orgId?: string
): Promise<RunMonitoredWebsiteAuditsResult> {

  const supabase = createServiceClient()

  // The unattended cron sweep (no orgId) only monitors Pro orgs daily --
  // Free tier gets manual audits only, via the interactive "Run
  // Scheduled Audits" button (which always passes an orgId and is
  // unaffected by this gate, since a human explicitly clicked it).
  let proOrgIds: string[] | null = null

  if (!orgId) {
    const { data: proOrgs } =
      await supabase
        .from("organizations")
        .select("id")
        .eq("plan", "pro")

    proOrgIds = (proOrgs || []).map((org) => org.id)

    if (proOrgIds.length === 0) {
      return {
        success: true,
        total: 0,
        results: []
      }
    }
  }

  let query =
    supabase
      .from("monitored_websites")
      .select("id,url,org_id,notification_email")

  if (orgId) {
    query = query.eq("org_id", orgId)
  } else if (proOrgIds) {
    query = query.in("org_id", proOrgIds)
  }

  let { data: websites, error } =
    await query as {
      data: MonitoredWebsiteRow[] | null
      error: { message: string } | null
    }

  if (
    error &&
    isMissingColumnError(
      error.message,
      ["notification_email"]
    )
  ) {
    let fallbackQuery =
      supabase
        .from("monitored_websites")
        .select("id,url,org_id")

    if (orgId) {
      fallbackQuery =
        fallbackQuery.eq("org_id", orgId)
    } else if (proOrgIds) {
      fallbackQuery =
        fallbackQuery.in("org_id", proOrgIds)
    }

    ({ data: websites, error } =
      await fallbackQuery as unknown as {
        data: MonitoredWebsiteRow[] | null
        error: { message: string } | null
      })
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
        await enqueueAudit(
          website.url,
          website.org_id
        )

      if (auditResult.success) {

        const { plan, name } =
          await getOrgPlanAndName(supabase, website.org_id)

        await checkInternalUsageAndAlert({
          plan,
          orgId: website.org_id,
          orgName: name,
          resource: "ai-calls"
        })

        await generateAndPersistAuditInsights({
          ...auditResult.data,
          orgId: website.org_id
        })

        await notifyIfRegressed(
          supabase,
          website
        )
      }

      await updateMonitoredWebsiteDiagnostics({
        id: website.id,
        url: website.url,
        orgId: website.org_id,
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
