import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { enqueueAudit } from "@/utils/auditQueue"
import {
  checkRateLimit,
  getRequestKey
} from "@/utils/rateLimit"
import { updateMonitoredWebsiteDiagnostics } from "@/utils/monitoredWebsiteDiagnostics"
import { generateAndPersistAuditInsights } from "@/utils/aiCopilot"

function isAuthorizedRequest(request: Request) {
  const cronSecret =
    process.env.CRON_SECRET

  if (!cronSecret) {
    if (process.env.NODE_ENV !== "production") {
      return true
    }

    console.error(
      "CRON_SECRET is not configured; refusing to run scheduled audits in production."
    )

    return false
  }

  const authorization =
    request.headers.get("authorization")

  const cronHeader =
    request.headers.get("x-cron-secret")

  return (
    authorization === `Bearer ${cronSecret}` ||
    cronHeader === cronSecret
  )
}

export async function GET(request: Request) {

  if (!isAuthorizedRequest(request)) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized"
      },
      {
        status: 401
      }
    )
  }

  const rateLimit =
    checkRateLimit({
      key: getRequestKey(
        request,
        "scheduled-audits"
      ),
      limit: 3,
      windowMs: 60_000
    })

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Too many scheduled audit requests. Please try again shortly.",
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

  try {

    const { data: websites, error } =
      await supabase
        .from("monitored_websites")
        .select("id,url")

    if (error) {

      return NextResponse.json(
        {
          success: false,
          error: error.message
        },
        {
          status: 500
        }
      )

    }

    const results = []

    for (const website of websites || []) {

      try {

        console.log(
          "Running scheduled audit:",
          website.url
        )

        const auditResult =
          await enqueueAudit(
            website.url
          )

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

          success:
            auditResult.success,

          status:
            auditResult.status,

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

    return NextResponse.json({

      success: true,

      total:
        websites?.length || 0,

      results

    })

  } catch (error) {

    console.error(error)

    return NextResponse.json(
      {
        success: false,
        error:
          "Failed to run scheduled audits"
      },
      {
        status: 500
      }
    )

  }

}
