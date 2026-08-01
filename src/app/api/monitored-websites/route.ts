import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/utils/organizations"
import { validateWebsiteUrl } from "@/utils/urlValidation"
import { validateReportRecipient } from "@/utils/emailReport"
import { isMissingColumnError } from "@/utils/schemaCompat"
import {
  checkRateLimit,
  getRequestKey
} from "@/utils/rateLimit"

const monitoredWebsiteSelect =
  "id,url,last_audited_at,last_failure_reason,last_audit_duration_ms,last_audit_status,last_audit_is_slow,notification_email,created_at"

const fallbackMonitoredWebsiteSelect =
  "id,url,last_audited_at,created_at"

const insertSelect =
  "id,url,last_audited_at,notification_email,created_at"

const diagnosticsColumns = [
  "last_failure_reason",
  "last_audit_duration_ms",
  "last_audit_status",
  "last_audit_is_slow",
  "notification_email"
]

function isMissingDiagnosticsColumn(
  message: string
) {
  return isMissingColumnError(
    message,
    diagnosticsColumns
  )
}

export async function GET() {

  const supabase = await createClient()

  // No manual org_id filter needed here — RLS restricts the result set
  // to rows in organizations the current session's user belongs to.
  const response =
    await supabase
      .from("monitored_websites")
      .select(monitoredWebsiteSelect)
      .order("created_at", {
        ascending: false
      })

  if (
    response.error &&
    isMissingDiagnosticsColumn(
      response.error.message
    )
  ) {
    const fallback =
      await supabase
        .from("monitored_websites")
        .select(fallbackMonitoredWebsiteSelect)
        .order("created_at", {
          ascending: false
        })

    if (!fallback.error) {
      return NextResponse.json({
        success: true,
        data:
          (fallback.data || []).map(
            (website) => ({
              ...website,
              last_failure_reason: null,
              last_audit_duration_ms: null,
              last_audit_status: null,
              last_audit_is_slow: false,
              notification_email: null
            })
          )
      })
    }
  }

  if (response.error) {

    console.error(
      "Failed to list monitored websites:",
      response.error
    )

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load monitored websites."
      },
      {
        status: 500
      }
    )

  }

  return NextResponse.json({
    success: true,
    data: response.data
  })

}

export async function POST(
  request: Request
) {

  const rateLimit =
    checkRateLimit({
      key: getRequestKey(
        request,
        "monitored-websites-create"
      ),
      limit: 10,
      windowMs: 60_000
    })

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Too many requests. Please try again shortly.",
        retryAfterSeconds:
          rateLimit.retryAfterSeconds
      },
      {
        status: 429,
        headers: {
          "Retry-After":
            String(
              rateLimit.retryAfterSeconds
            )
        }
      }
    )
  }

  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)

  if (!orgId) {
    return NextResponse.json(
      {
        success: false,
        error: "Authentication required."
      },
      {
        status: 401
      }
    )
  }

  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      {
        success: false,
        error:
          "Request body must be valid JSON."
      },
      {
        status: 400
      }
    )
  }

  const urlValidation =
    validateWebsiteUrl(
      (body as { url?: unknown }).url
    )

  if (!urlValidation.success) {
    return NextResponse.json(
      {
        success: false,
        error: urlValidation.error
      },
      {
        status: 400
      }
    )
  }

  const notificationEmailInput =
    (body as { notificationEmail?: unknown })
      .notificationEmail

  const notificationEmail =
    typeof notificationEmailInput === "string" &&
    notificationEmailInput.trim()
      ? notificationEmailInput.trim()
      : null

  if (
    notificationEmail &&
    !validateReportRecipient(notificationEmail)
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Please enter a valid notification email."
      },
      {
        status: 400
      }
    )
  }

  let insertResponse =
    await supabase
      .from("monitored_websites")
      .insert({
        url: urlValidation.url,
        org_id: orgId,
        notification_email: notificationEmail
      })
      .select(insertSelect)
      .single()

  if (
    insertResponse.error &&
    isMissingColumnError(
      insertResponse.error.message,
      ["notification_email"]
    )
  ) {
    insertResponse =
      await supabase
        .from("monitored_websites")
        .insert({
          url: urlValidation.url,
          org_id: orgId
        })
        .select(fallbackMonitoredWebsiteSelect)
        .single()
  }

  if (insertResponse.error) {

    console.error(
      "Failed to create monitored website:",
      insertResponse.error
    )

    const isDuplicate =
      insertResponse.error.message
        .toLowerCase()
        .includes("duplicate")

    return NextResponse.json(
      {
        success: false,
        error:
          isDuplicate
            ? "This website is already being monitored."
            : "Failed to create monitored website."
      },
      {
        status:
          isDuplicate ? 409 : 500
      }
    )

  }

  return NextResponse.json({
    success: true,
    data: {
      ...insertResponse.data,
      last_failure_reason:
        "last_failure_reason" in
        insertResponse.data
          ? insertResponse.data
              .last_failure_reason
          : null,
      last_audit_duration_ms:
        "last_audit_duration_ms" in
        insertResponse.data
          ? insertResponse.data
              .last_audit_duration_ms
          : null,
      last_audit_status:
        "last_audit_status" in
        insertResponse.data
          ? insertResponse.data
              .last_audit_status
          : null,
      last_audit_is_slow:
        "last_audit_is_slow" in
        insertResponse.data
          ? insertResponse.data
              .last_audit_is_slow
          : false,
      notification_email:
        "notification_email" in
        insertResponse.data
          ? insertResponse.data
              .notification_email
          : null
    }
  })

}
