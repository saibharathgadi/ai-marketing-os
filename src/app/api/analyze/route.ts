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
import { getCurrentOrgId, getOrgPlanAndName } from "@/utils/organizations"
import { checkInternalUsageAndAlert } from "@/utils/internalUsageMonitor"

// A full site crawl (sitemap discovery + multi-level link following) can
// legitimately take longer than the platform default; this opts into
// generous headroom above the crawler's own ~45s internal time budget
// (leaving room for AI insight generation afterward) rather than being
// killed mid-crawl. Confirmed this project has Fluid Compute enabled,
// which raises Hobby's max duration to 300s -- no cost difference for
// setting a higher ceiling since billing is based on actual CPU time
// used, not the timeout itself.
export const maxDuration = 120

export async function POST(
  req: Request
) {

  try {

    const supabase = await createClient()
    const orgId = await getCurrentOrgId(supabase)

    // Anonymous visitors get a capped teaser crawl instead of a hard
    // 401 — rate-limited more tightly since there's no org to hold
    // accountable for abuse.
    const isAnonymous = orgId === null

    const rateLimitKey =
      getRequestKey(
        req,
        isAnonymous ? "analyze-anon" : "analyze"
      )

    const rateLimit =
      await checkRateLimit(
        isAnonymous
          ? {
              key: rateLimitKey,
              limit: 2,
              windowMs: 10 * 60_000
            }
          : {
              key: rateLimitKey,
              limit: 6,
              windowMs: 60_000
            }
      )

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

    const websiteIdInput =
      (body as { websiteId?: unknown }).websiteId

    const websiteId =
      typeof websiteIdInput === "string" &&
      websiteIdInput.trim()
        ? websiteIdInput.trim()
        : undefined

    const urlValidation =
      await validateWebsiteUrl(
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
        orgId,
        isAnonymous
          ? {
              lockKey: `${rateLimitKey}:${urlValidation.url}`,
              maxPages: 2
            }
          : undefined
      )

    // Monitored-website diagnostics are an org concept (tracking a
    // site over time) — nothing to attach them to for an anonymous
    // teaser crawl. Checking `orgId` directly (not `isAnonymous`) so
    // TypeScript narrows it to non-null below.
    if (orgId) {

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

    }

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
    // Skipped for anonymous teaser audits — keeps the free preview
    // fast and free of AI-provider cost; the audit page already
    // hides the AI Copilot tabs when ai_insights is null.

    let aiInsights = null

    if (!isAnonymous && orgId) {

      const { plan, name } =
        await getOrgPlanAndName(supabase, orgId)

      await checkInternalUsageAndAlert({
        plan,
        orgId,
        orgName: name,
        resource: "ai-calls"
      })

      aiInsights =
        await generateAndPersistAuditInsights({
          ...auditData,
          orgId
        })

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
