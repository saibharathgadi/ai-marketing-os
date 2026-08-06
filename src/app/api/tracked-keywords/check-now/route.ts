import { NextResponse } from "next/server"
import {
  checkRateLimit,
  getRequestKey
} from "@/utils/rateLimit"
import { runScheduledKeywordChecks } from "@/utils/runScheduledKeywordChecks"
import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/utils/organizations"

/**
 * Interactive counterpart to /api/run-scheduled-keyword-checks. That
 * endpoint is gated by CRON_SECRET for automated callers and sweeps
 * every Pro organization; this one is what the "Check Keywords Now"
 * button calls, scoped to the current user's own organization only
 * (available on any plan, not just Pro).
 */
// Sweeps multiple tracked keywords sequentially, each its own Gemini
// grounded-search call -- needs headroom beyond a single request.
export const maxDuration = 300

export async function POST(request: Request) {

  const rateLimit =
    await checkRateLimit({
      key: getRequestKey(
        request,
        "check-now-tracked-keywords"
      ),
      limit: 3,
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

  try {

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

    const result =
      await runScheduledKeywordChecks(orgId)

    if (!result.success) {

      return NextResponse.json(
        result,
        {
          status: 500
        }
      )

    }

    return NextResponse.json(result)

  } catch (error) {

    console.error(error)

    return NextResponse.json(
      {
        success: false,
        error:
          "Failed to check keywords"
      },
      {
        status: 500
      }
    )

  }

}
