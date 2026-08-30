import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateCreativeVariations } from "@/utils/creativeGenerator"
import type { CreativeVariation } from "@/utils/contentItems"
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
        "content-items-generate-creative"
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

  // RLS-scoped fetch doubles as the ownership check -- a miss here
  // (wrong org, or logged out) 404s before any AI call fires, so a
  // stray/hostile id never spends provider quota.
  const { data: item, error: fetchError } =
    await supabase
      .from("content_items")
      .select("*")
      .eq("id", id)
      .single()

  if (fetchError || !item) {
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

  const { data: brandProfile } =
    await supabase
      .from("brand_profiles")
      .select("business_description,target_audience,tone_of_voice,key_differentiators")
      .eq("org_id", item.org_id)
      .maybeSingle()

  const generated =
    await generateCreativeVariations({
      type: item.type,
      title: item.title,
      body: item.body || {},
      notes: item.notes,
      brandProfile: brandProfile
        ? {
            businessDescription: brandProfile.business_description,
            targetAudience: brandProfile.target_audience,
            toneOfVoice: brandProfile.tone_of_voice,
            keyDifferentiators: brandProfile.key_differentiators
          }
        : null
    })

  const generatedAt = new Date().toISOString()

  const newBatch: CreativeVariation[] =
    generated.variations.map((variation) => ({
      ...variation,
      generatedAt,
      source: generated.source
    }))

  const existingVariations: CreativeVariation[] =
    Array.isArray(item.body?.creativeVariations)
      ? item.body.creativeVariations
      : []

  const mergedVariations =
    [...newBatch, ...existingVariations].slice(0, 9)

  const updatedBody = {
    ...(item.body || {}),
    creativeVariations: mergedVariations
  }

  const updateResponse =
    await supabase
      .from("content_items")
      .update({
        body: updatedBody,
        updated_at: generatedAt
      })
      .eq("id", id)
      .select("*")
      .single()

  if (updateResponse.error) {

    console.error(
      "Failed to persist generated creative:",
      updateResponse.error
    )

    return NextResponse.json(
      {
        success: false,
        error: "Content item was deleted or is no longer accessible."
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
