import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/utils/organizations"
import {
  checkRateLimit,
  getRequestKey
} from "@/utils/rateLimit"

export async function POST(
  request: Request
) {

  const rateLimit =
    await checkRateLimit({
      key: getRequestKey(
        request,
        "ad-sets-create"
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
      campaignId?: unknown
      audienceAngle?: unknown
      creativeAngle?: unknown
      suggestedBudgetSplit?: unknown
    }

  if (typeof input.campaignId !== "string" || !input.campaignId) {
    return NextResponse.json(
      {
        success: false,
        error: "campaignId is required."
      },
      {
        status: 400
      }
    )
  }

  // Confirm the campaign resolves under RLS (i.e. belongs to the current
  // user's org) before inserting — this is what keeps ad_sets.org_id
  // (denormalized for RLS simplicity) guaranteed to match its parent
  // campaign's org_id rather than trusting a client-supplied value.
  const campaignResponse =
    await supabase
      .from("campaigns")
      .select("id, org_id")
      .eq("id", input.campaignId)
      .single()

  if (campaignResponse.error || !campaignResponse.data) {
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

  const insertResponse =
    await supabase
      .from("ad_sets")
      .insert({
        campaign_id: campaignResponse.data.id,
        org_id: campaignResponse.data.org_id,
        audience_angle:
          typeof input.audienceAngle === "string"
            ? input.audienceAngle
            : null,
        creative_angle:
          typeof input.creativeAngle === "string"
            ? input.creativeAngle
            : null,
        suggested_budget_split:
          typeof input.suggestedBudgetSplit === "string"
            ? input.suggestedBudgetSplit
            : null,
        status: "draft"
      })
      .select("*")
      .single()

  if (insertResponse.error) {

    console.error(
      "Failed to create ad set:",
      insertResponse.error
    )

    return NextResponse.json(
      {
        success: false,
        error: "Failed to save ad set."
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
