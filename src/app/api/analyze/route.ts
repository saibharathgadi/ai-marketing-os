import { generateAIInsights } from "@/utils/aiCopilot"
import { NextResponse } from "next/server"
import { enqueueAudit } from "@/utils/auditQueue"
import {
  checkRateLimit,
  getRequestKey
} from "@/utils/rateLimit"
import { updateMonitoredWebsiteDiagnostics } from "@/utils/monitoredWebsiteDiagnostics"
import { validateWebsiteUrl } from "@/utils/urlValidation"
import { supabase } from "@/lib/supabase"

function isMissingAIInsightsColumn(
  message: string
) {
  const normalized =
    message.toLowerCase()

  return (
    normalized.includes("ai_insights") ||
    normalized.includes("schema cache")
  )
}

async function persistAIInsights(
  auditId: string | null | undefined,
  aiInsights: Awaited<
    ReturnType<typeof generateAIInsights>
  >
) {
  if (!auditId) {
    return
  }

  const { error } =
    await supabase
      .from("audits")
      .update({
        ai_insights: aiInsights
      })
      .eq("id", auditId)

  if (!error) {
    return
  }

  if (
    isMissingAIInsightsColumn(
      error.message
    )
  ) {
    console.warn(
      "ai_insights column is missing on audits; continuing without persisted AI insights."
    )

    return
  }

  console.error(
    "Failed to persist AI insights:",
    error
  )
}

export async function POST(
  req: Request
) {

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
        (body as {
          url?: unknown
        }).url
      )

    if (
      !urlValidation.success
    ) {

      return NextResponse.json(
        {
          success: false,
          error:
            urlValidation.error
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
      url:
        urlValidation.url,

      success:
        result.success,

      failureReason:
        result.success
          ? result.data
              .failureReason
          : result.failureReason,

      durationMs:
        result.success
          ? result.data
              .durationMs
          : result.durationMs,

      isSlow:
        result.success
          ? result.data
              .isSlow
          : false
    })

    // ======================================================
    // HANDLE FAILED AUDITS
    // ======================================================

    if (!result.success) {

      const status =
        result.status ===
        "locked"
          ? 409
          : result.status ===
              "queue_full"
            ? 503
            : result.status ===
                "invalid"
              ? 400
              : 400

      return NextResponse.json(
        result,
        {
          status
        }
      )

    }

    // ======================================================
    // SUCCESS PATH
    // ======================================================

    const auditData =
      result.data
    let aiInsights: Awaited<
      ReturnType<typeof generateAIInsights>
    > | null = null

    // ======================================================
    // AI INSIGHT GENERATION
    // ======================================================

    try {

      const topIssues =
        (
          auditData.crawledPages ||
          []
        )
          .flatMap(
            (
              page: {
                seoIssues?: string[]
              }
            ) =>
              page.seoIssues ||
              []
          )
          .filter(
            (
              issue: string,
              index: number,
              issues: string[]
            ) =>
              issues.indexOf(
                issue
              ) === index
          )

      const seoScore =
        auditData.siteSummary
          ?.averageSeoScore ??
        0

      const totalIssues =
        auditData.siteSummary
          ?.totalIssues ?? 0

      const healthStatus =
        seoScore >= 85
          ? "Stable"
          : seoScore >= 70
            ? "Warning"
            : "Critical"

      aiInsights =
        await generateAIInsights({
          seoScore,

          healthStatus,

          totalIssues,

          topIssues,

          regressions: [],

          detectedThemes: [],

          crawlDiagnostics: {
            slow:
              auditData.isSlow ??
              false,

            durationMs:
              auditData.durationMs ??
              null,

            failureReason:
              auditData.failureReason ??
              null
          }
        })

      await persistAIInsights(
        auditData.auditId,
        aiInsights
      )

    } catch (error) {

      console.error(
        "AI insight generation failed:",
        error
      )

    }

    // ======================================================
    // FINAL RESPONSE
    // ======================================================

    return NextResponse.json({
      success: true,
      data: auditData,
      aiInsights,
      queue: result.queue
    })

  } catch (error) {

    console.error(error)

    return NextResponse.json(
      {
        success: false,
        error:
          "Failed to analyze website."
      },
      {
        status: 500
      }
    )

  }

}
