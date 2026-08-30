import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/utils/organizations"
import {
  checkRateLimit,
  getRequestKey
} from "@/utils/rateLimit"

// A generous ceiling, not a plan-tier limit -- this exists purely to
// keep the audit-insights prompt from growing unbounded, not to
// restrict legitimate use (most orgs will name a handful of real
// competitors, not dozens).
const MAX_COMPETITORS_PER_ORG = 20

function normalizeUrl(value: unknown): string | null {

  if (typeof value !== "string") return null

  const trimmed = value.trim()
  if (!trimmed) return null

  try {
    const withProtocol =
      /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    return new URL(withProtocol).toString()
  } catch {
    return null
  }

}

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
      .from("competitors")
      .select("id,url,name,created_at")
      .eq("org_id", orgId)
      .order("created_at", {
        ascending: false
      })

  if (error) {

    console.error(
      "Failed to load competitors:",
      error
    )

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load competitors."
      },
      {
        status: 500
      }
    )

  }

  return NextResponse.json({
    success: true,
    data
  })

}

export async function POST(request: Request) {

  const rateLimit =
    await checkRateLimit({
      key: getRequestKey(
        request,
        "competitors-create"
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

  const { count: existingCount } =
    await supabase
      .from("competitors")
      .select("*", {
        count: "exact",
        head: true
      })
      .eq("org_id", orgId)

  if ((existingCount ?? 0) >= MAX_COMPETITORS_PER_ORG) {
    return NextResponse.json(
      {
        success: false,
        error: `You can track up to ${MAX_COMPETITORS_PER_ORG} competitors.`
      },
      {
        status: 403
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
      url?: unknown
      name?: unknown
    }

  const url = normalizeUrl(input.url)

  if (!url) {
    return NextResponse.json(
      {
        success: false,
        error: "Please enter a valid competitor URL."
      },
      {
        status: 400
      }
    )
  }

  const name =
    typeof input.name === "string" && input.name.trim()
      ? input.name.trim().slice(0, 200)
      : null

  const insertResponse =
    await supabase
      .from("competitors")
      .insert({
        org_id: orgId,
        url,
        name
      })
      .select("id,url,name,created_at")
      .single()

  if (insertResponse.error) {

    console.error(
      "Failed to add competitor:",
      insertResponse.error
    )

    return NextResponse.json(
      {
        success: false,
        error: "Failed to add competitor."
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
