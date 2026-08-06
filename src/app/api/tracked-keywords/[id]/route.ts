import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  checkRateLimit,
  getRequestKey
} from "@/utils/rateLimit"

const TRACKED_KEYWORD_STATUSES = ["active", "paused", "archived"] as const

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ id: string }>
  }
) {

  const rateLimit =
    await checkRateLimit({
      key: getRequestKey(
        request,
        "tracked-keywords-update"
      ),
      limit: 30,
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

  const { id } =
    await context.params

  let body: unknown

  try {
    body = await request.json()
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

  const status =
    (body as { status?: unknown }).status

  if (
    typeof status !== "string" ||
    !TRACKED_KEYWORD_STATUSES.includes(
      status as (typeof TRACKED_KEYWORD_STATUSES)[number]
    )
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid status."
      },
      {
        status: 400
      }
    )
  }

  const supabase = await createClient()

  const updateResponse =
    await supabase
      .from("tracked_keywords")
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select("id,keyword,target_domain,monitored_website_id,status,created_at")
      .single()

  if (updateResponse.error) {

    return NextResponse.json(
      {
        success: false,
        error: "Tracked keyword not found."
      },
      {
        status: 404
      }
    )

  }

  return NextResponse.json({
    success: true,
    data: updateResponse.data
  })

}

export async function DELETE(
  request: Request,
  context: {
    params: Promise<{ id: string }>
  }
) {

  const rateLimit =
    await checkRateLimit({
      key: getRequestKey(
        request,
        "tracked-keywords-delete"
      ),
      limit: 20,
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

  const { id } =
    await context.params

  const supabase = await createClient()

  // No manual org ownership check needed — the RLS delete policy on
  // tracked_keywords already restricts this to rows in organizations
  // the current session's user belongs to. keyword_checks cascade via
  // their tracked_keyword_id FK.
  const { error } =
    await supabase
      .from("tracked_keywords")
      .delete()
      .eq("id", id)

  if (error) {

    console.error(
      "Failed to delete tracked keyword:",
      error
    )

    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete tracked keyword."
      },
      {
        status: 500
      }
    )

  }

  return NextResponse.json({
    success: true
  })

}
