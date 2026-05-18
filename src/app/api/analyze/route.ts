import { generateAIInsights } from "@/utils/aiCopilot"
import { NextResponse } from "next/server"
import { enqueueAudit } from "@/utils/auditQueue"
import {
  checkRateLimit,
  getRequestKey
} from "@/utils/rateLimit"
import { updateMonitoredWebsiteDiagnostics } from "@/utils/monitoredWebsiteDiagnostics"
import { validateWebsiteUrl } from "@/utils/urlValidation"

export async function POST(req: Request) {

  try {
    const rateLimit =
      checkRateLimit({
        key: getRequestKey(
          req,
          "analyze"
        ),
        limit: 6,
        windowMs: 60_000
      })

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Too many audit requests. Please try again shortly.",
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

    let body: unknown

    try {
      body = await req.json()
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

    const result =
      await enqueueAudit(
        urlValidation.url
      )

    await updateMonitoredWebsiteDiagnostics({
      url: urlValidation.url,
      success: result.success,
      failureReason:
        result.success
          ? result.data.failureReason
          : result.failureReason,
      durationMs:
        result.success
          ? result.data.durationMs
          : result.durationMs,
      isSlow:
        result.success
          ? result.data.isSlow
          : false
    })

    if (!result.success) {
      const status =
        result.status === "locked"
          ? 409
          : result.status === "queue_full"
            ? 503
            : result.status === "invalid"
              ? 400
              : 400

      return NextResponse.json(
        result,
        {
          status
        }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      queue: result.queue
    })

  } catch (error) {

    console.error(error)

    return NextResponse.json(
      {
        success: false,
        error: "Failed to analyze website."
      },
      {
        status: 500
      }
    )

  }
}
