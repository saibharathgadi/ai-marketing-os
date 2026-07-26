import { NextResponse } from "next/server"
import {
  checkRateLimit,
  getRequestKey
} from "@/utils/rateLimit"
import { runMonitoredWebsiteAudits } from "@/utils/runMonitoredWebsiteAudits"

/**
 * Interactive counterpart to /api/run-scheduled-audits. That endpoint is
 * gated by CRON_SECRET for automated/external callers; this one is what
 * the dashboard's "Run Scheduled Audits" button calls directly from the
 * browser, so it deliberately does not require the cron secret (a
 * browser fetch can't safely hold one). Rate limiting is the only
 * abuse guard here until real user authentication exists.
 */
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

    const result =
      await runMonitoredWebsiteAudits()

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
