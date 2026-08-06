import { NextResponse } from "next/server"
import {
  checkRateLimit,
  getRequestKey
} from "@/utils/rateLimit"
import { runScheduledKeywordChecks } from "@/utils/runScheduledKeywordChecks"

function isAuthorizedRequest(request: Request) {
  const cronSecret =
    process.env.CRON_SECRET

  if (!cronSecret) {
    if (process.env.NODE_ENV !== "production") {
      return true
    }

    console.error(
      "CRON_SECRET is not configured; refusing to run scheduled keyword checks in production."
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

// Sweeps every active tracked keyword across all Pro orgs sequentially,
// each its own Gemini grounded-search call plus citation-domain
// redirect resolution -- needs headroom beyond a single check.
export const maxDuration = 300

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
    await checkRateLimit({
      key: getRequestKey(
        request,
        "scheduled-keyword-checks"
      ),
      limit: 3,
      windowMs: 60_000
    })

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Too many scheduled keyword check requests. Please try again shortly.",
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
      await runScheduledKeywordChecks()

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
          "Failed to run scheduled keyword checks"
      },
      {
        status: 500
      }
    )

  }

}
