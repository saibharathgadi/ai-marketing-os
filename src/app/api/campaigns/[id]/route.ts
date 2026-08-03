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
    checkRateLimit({
      key: getRequestKey(
        request,
        "campaigns-update"
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
      name?: unknown
      objective?: unknown
      targetAudience?: unknown
      keyMessage?: unknown
      channels?: unknown
      status?: unknown
      budget?: unknown
      startDate?: unknown
      endDate?: unknown
      notes?: unknown
    }

  const updates: Record<string, unknown> = {}

  if (input.name !== undefined) {
    const name =
      typeof input.name === "string"
        ? input.name.trim()
        : ""

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          error: "Campaign name cannot be empty."
        },
        {
          status: 400
        }
      )
    }

    updates.name = name
  }

  if (input.objective !== undefined) {
    updates.objective =
      typeof input.objective === "string"
        ? input.objective
        : null
  }

  if (input.targetAudience !== undefined) {
    updates.target_audience =
      typeof input.targetAudience === "string"
        ? input.targetAudience
        : null
  }

  if (input.keyMessage !== undefined) {
    updates.key_message =
      typeof input.keyMessage === "string"
        ? input.keyMessage
        : null
  }

  if (input.channels !== undefined) {
    updates.channels =
      Array.isArray(input.channels)
        ? input.channels.filter(
            (channel): channel is string =>
              typeof channel === "string"
          )
        : []
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

  if (input.budget !== undefined) {
    updates.budget =
      typeof input.budget === "number" &&
      Number.isFinite(input.budget)
        ? input.budget
        : null
  }

  if (input.startDate !== undefined) {
    updates.start_date =
      typeof input.startDate === "string" &&
      input.startDate
        ? input.startDate
        : null
  }

  if (input.endDate !== undefined) {
    updates.end_date =
      typeof input.endDate === "string" &&
      input.endDate
        ? input.endDate
        : null
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
      .from("campaigns")
      .update(updates)
      .eq("id", id)
      .select("*, ad_sets(*)")
      .single()

  if (updateResponse.error) {

    return NextResponse.json(
      {
        success: false,
        error: "Campaign not found."
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
    checkRateLimit({
      key: getRequestKey(
        request,
        "campaigns-delete"
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
  // campaigns already restricts this to rows in organizations the current
  // session's user belongs to. ad_sets cascade via their campaign_id FK.
  const { error } =
    await supabase
      .from("campaigns")
      .delete()
      .eq("id", id)

  if (error) {

    console.error(
      "Failed to delete campaign:",
      error
    )

    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete campaign."
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
