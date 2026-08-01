import { NextResponse } from "next/server"
import {
  checkRateLimit,
  getRequestKey
} from "@/utils/rateLimit"
import { runMonitoredWebsiteAudits } from "@/utils/runMonitoredWebsiteAudits"
import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/utils/organizations"

/**
 * Interactive counterpart to /api/run-scheduled-audits. That endpoint is
 * gated by CRON_SECRET for automated/external callers and sweeps every
 * organization; this one is what the dashboard's "Run Scheduled Audits"
 * button calls, scoped to the current user's own organization only.
 */
export const maxDuration = 60

export async function POST(request: Request) {

  const rateLimit =
    checkRateLimit({
      key: getRequestKey(
        request,
        "run-all-monitored-websites"
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
      await runMonitoredWebsiteAudits(orgId)

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
          "Failed to run scheduled audits"
      },
      {
        status: 500
      }
    )

  }

}
