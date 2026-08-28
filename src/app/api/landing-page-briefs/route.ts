import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/utils/organizations"
import { generateLandingPageBrief } from "@/utils/landingPageBriefGenerator"
import {
  checkRateLimit,
  getRequestKey
} from "@/utils/rateLimit"

export async function POST(request: Request) {

  const rateLimit =
    await checkRateLimit({
      key: getRequestKey(
        request,
        "landing-page-briefs-create"
      ),
      limit: 8,
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
        error: "Request body must be valid JSON."
      },
      {
        status: 400
      }
    )
  }

  const input =
    body as {
      campaignId?: unknown
      title?: unknown
      targetOffer?: unknown
    }

  const title =
    typeof input.title === "string" ? input.title.trim() : ""

  const targetOffer =
    typeof input.targetOffer === "string" ? input.targetOffer.trim() : ""

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

  if (!targetOffer) {
    return NextResponse.json(
      {
        success: false,
        error: "Target offer is required."
      },
      {
        status: 400
      }
    )
  }

  // Confirm the campaign resolves under RLS (i.e. belongs to the current
  // user's org) before generating or inserting anything -- this is what
  // keeps landing_page_briefs.org_id (denormalized for RLS simplicity)
  // guaranteed to match its parent campaign's org_id rather than
  // trusting a client-supplied value, and stops a stray/hostile
  // campaignId from spending AI-provider quota before it 404s.
  const campaignResponse =
    await supabase
      .from("campaigns")
      .select("id,org_id,name,objective,target_audience,key_message")
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

  const { data: brandProfile } =
    await supabase
      .from("brand_profiles")
      .select("business_description,target_audience,tone_of_voice,key_differentiators")
      .eq("org_id", orgId)
      .maybeSingle()

  const generated =
    await generateLandingPageBrief({
      targetOffer,
      campaign: {
        name: campaignResponse.data.name,
        objective: campaignResponse.data.objective,
        targetAudience: campaignResponse.data.target_audience,
        keyMessage: campaignResponse.data.key_message
      },
      brandProfile: brandProfile
        ? {
            businessDescription: brandProfile.business_description,
            targetAudience: brandProfile.target_audience,
            toneOfVoice: brandProfile.tone_of_voice,
            keyDifferentiators: brandProfile.key_differentiators
          }
        : null
    })

  const insertResponse =
    await supabase
      .from("landing_page_briefs")
      .insert({
        campaign_id: campaignResponse.data.id,
        org_id: campaignResponse.data.org_id,
        title,
        target_offer: targetOffer,
        sections: generated.sections,
        status: "draft"
      })
      .select("*")
      .single()

  if (insertResponse.error) {

    console.error(
      "Failed to create landing page brief:",
      insertResponse.error
    )

    return NextResponse.json(
      {
        success: false,
        error: "Failed to save landing page brief."
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
