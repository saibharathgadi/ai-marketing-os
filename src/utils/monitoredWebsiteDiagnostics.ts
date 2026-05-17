import { supabase } from "@/lib/supabase"
import type { CrawlFailureReason } from "./crawler"

type DiagnosticsPayload = {
  id?: string
  url: string
  success: boolean
  failureReason?: CrawlFailureReason | null
  durationMs?: number
  isSlow?: boolean
}

function isMissingDiagnosticsColumn(
  message: string
) {
  const normalized =
    message.toLowerCase()

  return (
    normalized.includes(
      "last_failure_reason"
    ) ||
    normalized.includes(
      "last_audit_duration_ms"
    ) ||
    normalized.includes(
      "last_audit_status"
    ) ||
    normalized.includes(
      "last_audit_is_slow"
    ) ||
    normalized.includes("schema cache")
  )
}

export async function updateMonitoredWebsiteDiagnostics({
  id,
  url,
  success,
  failureReason,
  durationMs,
  isSlow
}: DiagnosticsPayload) {
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
