import { generateAndPersistAuditInsights } from "@/utils/aiCopilot"
import { NextResponse } from "next/server"
import { enqueueAudit } from "@/utils/auditQueue"
import {
  checkRateLimit,
  getRequestKey
} from "@/utils/rateLimit"
import { updateMonitoredWebsiteDiagnostics } from "@/utils/monitoredWebsiteDiagnostics"
import { validateWebsiteUrl } from "@/utils/urlValidation"
import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/utils/organizations"

// A full site crawl (sitemap discovery + multi-level link following) can
// legitimately take longer than the platform default; this opts into
// the longest duration the current plan allows rather than being killed
// mid-crawl. crawler.ts's own internal time budget still stops the
// crawl safely before this ceiling.
export const maxDuration = 60

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

    const supabase = await createClient()
    const orgId = await getCurrentOrgId(supabase)

    if (!orgId) {

      return NextResponse.json(
        {
          success: false,
          error:
            "Authentication required."
        },
        {
          status: 401
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

    const websiteIdInput =
      (body as { websiteId?: unknown }).websiteId

    const websiteId =
      typeof websiteIdInput === "string" &&
      websiteIdInput.trim()
        ? websiteIdInput.trim()
        : undefined

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
        urlValidation.url,
        orgId
      )

    await updateMonitoredWebsiteDiagnostics({
      id:
        websiteId,

      url:
        urlValidation.url,

      orgId,

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

    // ======================================================
    // AI INSIGHT GENERATION
    // ======================================================

    const aiInsights =
      await generateAndPersistAuditInsights(
        auditData
      )

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
