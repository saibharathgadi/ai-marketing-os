import { supabase } from "@/lib/supabase"
import { enqueueAudit } from "./auditQueue"
import { updateMonitoredWebsiteDiagnostics } from "./monitoredWebsiteDiagnostics"
import { generateAndPersistAuditInsights } from "./aiCopilot"

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

  const { data: websites, error } =
    await supabase
      .from("monitored_websites")
      .select("id,url")

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
