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
        // ======================================================
// AI INSIGHT GENERATION
// ======================================================

try {

  const auditData = result.data

  const aiInsights =
    await generateAIInsights({
      seoScore:
        auditData.seoScore ?? 0,

      healthStatus:
        auditData.healthStatus ??
        "Stable",

      totalIssues:
        auditData.totalIssues ?? 0,

      topIssues:
        Array.isArray(
          auditData.topIssues
        )
          ? auditData.topIssues
          : [],

      regressions:
        Array.isArray(
          auditData.regressions
        )
          ? auditData.regressions
          : [],

      detectedThemes:
        Array.isArray(
          auditData.detectedThemes
        )
          ? auditData.detectedThemes
          : [],

      crawlDiagnostics: {
        slow:
          auditData.isSlow ?? false,

        durationMs:
          auditData.durationMs ?? null,

        failureReason:
          auditData.failureReason ??
          null
      }
    })

  // Save AI insights into audit row
  if (auditData.auditId) {

    const { createClient } =
      await import(
        "@supabase/supabase-js"
      )

    const supabase =
      createClient(
        process.env
          .NEXT_PUBLIC_SUPABASE_URL!,
        process.env
          .SUPABASE_SERVICE_ROLE_KEY!
      )

    await supabase
      .from("audits")
      .update({
        ai_insights: aiInsights
      })
      .eq(
        "id",
        auditData.auditId
      )

  }

} catch (error) {

  console.error(
    "AI insight generation failed:",
    error
  )

}
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
