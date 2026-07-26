import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { validateWebsiteUrl } from "@/utils/urlValidation"
import { validateReportRecipient } from "@/utils/emailReport"
import { isMissingColumnError } from "@/utils/schemaCompat"

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
          url: urlValidation.url
        })
        .select(fallbackMonitoredWebsiteSelect)
        .single()
  }

  if (insertResponse.error) {

    console.error(
      "Failed to create monitored website:",
      insertResponse.error
    )

    return NextResponse.json(
      {
        success: false,
        error: "Failed to create monitored website."
      },
      {
        status: 500
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
