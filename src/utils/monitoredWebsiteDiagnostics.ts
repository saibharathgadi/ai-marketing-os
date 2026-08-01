import { createServiceClient } from "@/lib/supabase/service"
import type { CrawlFailureReason } from "./crawler"
import { isMissingColumnError } from "./schemaCompat"

const diagnosticsColumns = [
  "last_failure_reason",
  "last_audit_duration_ms",
  "last_audit_status",
  "last_audit_is_slow"
]

type DiagnosticsPayload = {
  id?: string
  url: string
  orgId: string
  success: boolean
  failureReason?: CrawlFailureReason | null
  durationMs?: number
  isSlow?: boolean
}

function isMissingDiagnosticsColumn(
  message: string
) {
  return isMissingColumnError(
    message,
    diagnosticsColumns
  )
}

export async function updateMonitoredWebsiteDiagnostics({
  id,
  url,
  orgId,
  success,
  failureReason,
  durationMs,
  isSlow
}: DiagnosticsPayload) {
  const supabase = createServiceClient()

  const diagnosticsUpdate = {
    ...(success
      ? {
          last_audited_at:
            new Date().toISOString()
        }
      : {}),
    last_failure_reason:
      success
        ? null
        : failureReason || "unknown",
    last_audit_duration_ms:
      typeof durationMs === "number"
        ? durationMs
        : null,
    last_audit_status:
      success ? "completed" : "failed",
    last_audit_is_slow:
      Boolean(isSlow)
  }

  let query =
    supabase
      .from("monitored_websites")
      .update(diagnosticsUpdate)
      .eq("org_id", orgId)

  query = id
    ? query.eq("id", id)
    : query.eq("url", url)

  const { error } = await query

  if (!error) {
    return
  }

  if (!isMissingDiagnosticsColumn(error.message)) {
    console.error(
      "Failed to update monitored website diagnostics:",
      error
    )
    return
  }

  if (!success) {
    console.warn(
      "Monitored website diagnostic columns are missing; failure reason was not persisted."
    )
    return
  }

  let fallbackQuery =
    supabase
      .from("monitored_websites")
      .update({
        last_audited_at:
          new Date().toISOString()
      })
      .eq("org_id", orgId)

  fallbackQuery = id
    ? fallbackQuery.eq("id", id)
    : fallbackQuery.eq("url", url)

  const { error: fallbackError } =
    await fallbackQuery

  if (fallbackError) {
    console.error(
      "Failed to update monitored website audit timestamp:",
      fallbackError
    )
  }
}
