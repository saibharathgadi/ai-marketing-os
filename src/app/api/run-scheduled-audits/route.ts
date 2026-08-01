import { NextResponse } from "next/server"
import {
  checkRateLimit,
  getRequestKey
} from "@/utils/rateLimit"
import { runMonitoredWebsiteAudits } from "@/utils/runMonitoredWebsiteAudits"

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

export const maxDuration = 60

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
