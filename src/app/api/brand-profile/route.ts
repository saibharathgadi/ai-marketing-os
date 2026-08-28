import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/utils/organizations"
import {
  checkRateLimit,
  getRequestKey
} from "@/utils/rateLimit"

const MAX_FIELD_LENGTH = 2000

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

  const { data, error } =
    await supabase
      .from("brand_profiles")
      .select("*")
      .eq("org_id", orgId)
      .maybeSingle()

  if (error) {

    console.error(
      "Failed to load brand profile:",
      error
    )

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load brand profile."
      },
      {
        status: 500
      }
    )

  }

  return NextResponse.json({
    success: true,
    data: data ?? null
  })

}

export async function PUT(request: Request) {

  const rateLimit =
    await checkRateLimit({
      key: getRequestKey(
        request,
        "brand-profile-update"
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
      businessDescription?: unknown
      targetAudience?: unknown
      toneOfVoice?: unknown
      keyDifferentiators?: unknown
    }

  function normalizeField(value: unknown): string | null {
    if (typeof value !== "string") return null
    const trimmed = value.trim()
    if (!trimmed) return null
    return trimmed.slice(0, MAX_FIELD_LENGTH)
  }

  const updates = {
    org_id: orgId,
    business_description: normalizeField(input.businessDescription),
    target_audience: normalizeField(input.targetAudience),
    tone_of_voice: normalizeField(input.toneOfVoice),
    key_differentiators: normalizeField(input.keyDifferentiators),
    updated_at: new Date().toISOString()
  }

  const upsertResponse =
    await supabase
      .from("brand_profiles")
      .upsert(updates, { onConflict: "org_id" })
      .select("*")
      .single()

  if (upsertResponse.error) {

    console.error(
      "Failed to save brand profile:",
      upsertResponse.error
    )

    return NextResponse.json(
      {
        success: false,
        error: "Failed to save brand profile."
      },
      {
        status: 500
      }
    )

  }

  return NextResponse.json({
    success: true,
    data: upsertResponse.data
  })

}
