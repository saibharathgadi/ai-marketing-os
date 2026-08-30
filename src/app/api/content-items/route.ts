import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/utils/organizations"
import { CONTENT_ITEM_TYPES } from "@/utils/contentItems"
import {
  checkRateLimit,
  getRequestKey
} from "@/utils/rateLimit"

export async function GET() {

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

  // RLS alone only proves membership in SOME org the user belongs to --
  // a gated multi-org user legitimately has RLS visibility into every
  // org they're in, not just the active one. Without this explicit
  // filter, a two-org user's content list was a union of both orgs.
  const response =
    await supabase
      .from("content_items")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", {
        ascending: false
      })

  if (response.error) {

    console.error(
      "Failed to list content items:",
      response.error
    )

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load content items."
      },
      {
        status: 500
      }
    )

  }

  return NextResponse.json({
    success: true,
    data: response.data
  })

}

export async function POST(
  request: Request
) {

  const rateLimit =
    await checkRateLimit({
      key: getRequestKey(
        request,
        "content-items-create"
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
      type?: unknown
      title?: unknown
      body?: unknown
      auditId?: unknown
      siteUrl?: unknown
    }

  if (
    typeof input.type !== "string" ||
    !CONTENT_ITEM_TYPES.includes(
      input.type as (typeof CONTENT_ITEM_TYPES)[number]
    )
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid content item type."
      },
      {
        status: 400
      }
    )
  }

  const title =
    typeof input.title === "string"
      ? input.title.trim()
      : ""

  if (!title) {
    return NextResponse.json(
      {
        success: false,
        error: "Title is required."
      },
      {
        status: 400
      }
    )
  }

  const insertResponse =
    await supabase
      .from("content_items")
      .insert({
        org_id: orgId,
        audit_id:
          typeof input.auditId === "string"
            ? input.auditId
            : null,
        site_url:
          typeof input.siteUrl === "string"
            ? input.siteUrl
            : null,
        type: input.type,
        status: "idea",
        title,
        body:
          input.body &&
          typeof input.body === "object"
            ? input.body
            : {}
      })
      .select("*")
      .single()

  if (insertResponse.error) {

    console.error(
      "Failed to create content item:",
      insertResponse.error
    )

    return NextResponse.json(
      {
        success: false,
        error: "Failed to save content item."
      },
      {
        status: 500
      }
    )

  }

  return NextResponse.json({
    success: true,
    data: insertResponse.data
  })

}
