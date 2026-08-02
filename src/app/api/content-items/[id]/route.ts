import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { CONTENT_ITEM_STATUSES } from "@/utils/contentItems"
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
        "content-items-update"
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
      title?: unknown
      status?: unknown
      notes?: unknown
    }

  const updates: Record<string, unknown> = {}

  if (input.title !== undefined) {
    const title =
      typeof input.title === "string"
        ? input.title.trim()
        : ""

    if (!title) {
      return NextResponse.json(
        {
          success: false,
          error: "Title cannot be empty."
        },
        {
          status: 400
        }
      )
    }

    updates.title = title
  }

  if (input.status !== undefined) {
    if (
      typeof input.status !== "string" ||
      !CONTENT_ITEM_STATUSES.includes(
        input.status as (typeof CONTENT_ITEM_STATUSES)[number]
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
      .from("content_items")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single()

  if (updateResponse.error) {

    return NextResponse.json(
      {
        success: false,
        error: "Content item not found."
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
        "content-items-delete"
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
  // content_items already restricts this to rows in organizations the
  // current session's user belongs to.
  const { error } =
    await supabase
      .from("content_items")
      .delete()
      .eq("id", id)

  if (error) {

    console.error(
      "Failed to delete content item:",
      error
    )

    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete content item."
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
