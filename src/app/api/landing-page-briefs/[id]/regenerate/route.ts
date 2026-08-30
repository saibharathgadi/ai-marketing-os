import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/utils/organizations"
import { generateLandingPageBrief } from "@/utils/landingPageBriefGenerator"
import {
  checkRateLimit,
  getRequestKey
} from "@/utils/rateLimit"

export async function POST(
  request: Request,
  context: {
    params: Promise<{ id: string }>
  }
) {

  const rateLimit =
    await checkRateLimit({
      key: getRequestKey(
        request,
        "landing-page-briefs-regenerate"
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

  const { id } =
    await context.params

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

  // Explicit org_id filter, not just an RLS-scoped fetch -- RLS alone
  // only proves the brief is in SOME org this user belongs to, which
  // for a gated multi-org user could be a different (non-active) org.
  // Without this, the brief below would be regenerated using the
  // ACTIVE org's brand voice even if the brief itself belongs to the
  // other org.
  const { data: brief, error: briefError } =
    await supabase
      .from("landing_page_briefs")
      .select("id,target_offer,campaign_id,org_id")
      .eq("id", id)
      .eq("org_id", orgId)
      .single()

  if (briefError || !brief) {
    return NextResponse.json(
      {
        success: false,
        error: "Landing page brief not found."
      },
      {
        status: 404
      }
    )
  }

  const { data: campaign, error: campaignError } =
    await supabase
      .from("campaigns")
      .select("name,objective,target_audience,key_message")
      .eq("id", brief.campaign_id)
      .eq("org_id", brief.org_id)
      .single()

  if (campaignError || !campaign) {
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
      .eq("org_id", brief.org_id)
      .maybeSingle()

  const generated =
    await generateLandingPageBrief({
      targetOffer: brief.target_offer,
      campaign: {
        name: campaign.name,
        objective: campaign.objective,
        targetAudience: campaign.target_audience,
        keyMessage: campaign.key_message
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

  const updateResponse =
    await supabase
      .from("landing_page_briefs")
      .update({
        sections: generated.sections,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select("*")
      .single()

  if (updateResponse.error) {

    console.error(
      "Failed to persist regenerated brief:",
      updateResponse.error
    )

    return NextResponse.json(
      {
        success: false,
        error: "Landing page brief was deleted or is no longer accessible."
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
