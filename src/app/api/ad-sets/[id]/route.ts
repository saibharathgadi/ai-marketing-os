import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { CAMPAIGN_STATUSES } from "@/utils/campaigns"
import {
  checkRateLimit,
  getRequestKey
} from "@/utils/rateLimit"

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
        "ad-sets-update"
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

  const input =
    body as {
      audienceAngle?: unknown
      creativeAngle?: unknown
      suggestedBudgetSplit?: unknown
      status?: unknown
      notes?: unknown
    }

  const updates: Record<string, unknown> = {}

  if (input.audienceAngle !== undefined) {
    updates.audience_angle =
      typeof input.audienceAngle === "string"
        ? input.audienceAngle
        : null
  }

  if (input.creativeAngle !== undefined) {
    updates.creative_angle =
      typeof input.creativeAngle === "string"
        ? input.creativeAngle
        : null
  }

  if (input.suggestedBudgetSplit !== undefined) {
    updates.suggested_budget_split =
      typeof input.suggestedBudgetSplit === "string"
        ? input.suggestedBudgetSplit
        : null
  }

  if (input.status !== undefined) {
    if (
      typeof input.status !== "string" ||
      !CAMPAIGN_STATUSES.includes(
        input.status as (typeof CAMPAIGN_STATUSES)[number]
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

    updates.status = input.status
  }

  if (input.notes !== undefined) {
    updates.notes =
      typeof input.notes === "string"
        ? input.notes
        : null
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: "Nothing to update."
      },
      {
        status: 400
      }
    )
  }

  updates.updated_at = new Date().toISOString()

  const supabase = await createClient()

  const updateResponse =
    await supabase
      .from("ad_sets")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single()

  if (updateResponse.error) {

    return NextResponse.json(
      {
        success: false,
        error: "Ad set not found."
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
        "ad-sets-delete"
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
  // ad_sets already restricts this to rows in organizations the current
  // session's user belongs to.
  const { error } =
    await supabase
      .from("ad_sets")
      .delete()
      .eq("id", id)

  if (error) {

    console.error(
      "Failed to delete ad set:",
      error
    )

    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete ad set."
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
