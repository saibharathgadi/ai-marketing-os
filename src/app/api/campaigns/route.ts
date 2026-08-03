import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/utils/organizations"
import {
  checkRateLimit,
  getRequestKey
} from "@/utils/rateLimit"

export async function GET() {

  const supabase = await createClient()

  // No manual org_id filter needed — RLS restricts both tables to
  // organizations the current session's user belongs to. Supabase embeds
  // ad_sets via its campaign_id foreign key in one round trip.
  const response =
    await supabase
      .from("campaigns")
      .select("*, ad_sets(*)")
      .order("created_at", {
        ascending: false
      })

  if (response.error) {

    console.error(
      "Failed to list campaigns:",
      response.error
    )

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load campaigns."
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
    checkRateLimit({
      key: getRequestKey(
        request,
        "campaigns-create"
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
      name?: unknown
      objective?: unknown
      targetAudience?: unknown
      keyMessage?: unknown
      channels?: unknown
      auditId?: unknown
      siteUrl?: unknown
    }

  const name =
    typeof input.name === "string"
      ? input.name.trim()
      : ""

  if (!name) {
    return NextResponse.json(
      {
        success: false,
        error: "Campaign name is required."
      },
      {
        status: 400
      }
    )
  }

  const channels =
    Array.isArray(input.channels)
      ? input.channels.filter(
          (channel): channel is string =>
            typeof channel === "string"
        )
      : []

  const insertResponse =
    await supabase
      .from("campaigns")
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
        name,
        objective:
          typeof input.objective === "string"
            ? input.objective
            : null,
        target_audience:
          typeof input.targetAudience === "string"
            ? input.targetAudience
            : null,
        key_message:
          typeof input.keyMessage === "string"
            ? input.keyMessage
            : null,
        channels,
        status: "draft"
      })
      .select("*, ad_sets(*)")
      .single()

  if (insertResponse.error) {

    console.error(
      "Failed to create campaign:",
      insertResponse.error
    )

    return NextResponse.json(
      {
        success: false,
        error: "Failed to save campaign."
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
