import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/utils/organizations"
import { getPlanLimits } from "@/utils/planLimits"
import {
  checkRateLimit,
  getRequestKey
} from "@/utils/rateLimit"

const trackedKeywordSelect =
  "id,keyword,target_domain,monitored_website_id,status,created_at," +
  "keyword_checks(was_cited,cited_domains,competitor_domains,created_at)"

export async function GET() {

  const supabase = await createClient()

  // No manual org_id filter needed here — RLS restricts the result set
  // to rows in organizations the current session's user belongs to.
  const { data, error } =
    await supabase
      .from("tracked_keywords")
      .select(trackedKeywordSelect)
      .order("created_at", {
        ascending: false
      })
      .order("created_at", {
        ascending: false,
        referencedTable: "keyword_checks"
      })
      .limit(2, {
        referencedTable: "keyword_checks"
      })

  if (error) {

    console.error(
      "Failed to list tracked keywords:",
      error
    )

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load tracked keywords."
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

export async function POST(
  request: Request
) {

  const rateLimit =
    await checkRateLimit({
      key: getRequestKey(
        request,
        "tracked-keywords-create"
      ),
      limit: 10,
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

  const orgResponse =
    await supabase
      .from("organizations")
      .select("plan")
      .eq("id", orgId)
      .single()

  const plan = orgResponse.data?.plan ?? "free"

  const { count: keywordCount } =
    await supabase
      .from("tracked_keywords")
      .select("*", {
        count: "exact",
        head: true
      })
      .eq("org_id", orgId)

  if (
    (keywordCount ?? 0) >=
    getPlanLimits(plan).trackedKeywords
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          plan === "pro"
            ? "You've reached your plan's tracked keyword limit."
            : "Free plan is limited to 3 tracked keywords. Upgrade to Pro to track more."
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
      keyword?: unknown
      monitoredWebsiteId?: unknown
      targetDomain?: unknown
    }

  const keyword =
    typeof input.keyword === "string"
      ? input.keyword.trim()
      : ""

  if (!keyword) {
    return NextResponse.json(
      {
        success: false,
        error: "Keyword cannot be empty."
      },
      {
        status: 400
      }
    )
  }

  let targetDomain: string | null = null
  let monitoredWebsiteId: string | null = null

  if (
    typeof input.monitoredWebsiteId === "string" &&
    input.monitoredWebsiteId
  ) {

    const { data: website } =
      await supabase
        .from("monitored_websites")
        .select("id,url")
        .eq("id", input.monitoredWebsiteId)
        .single()

    if (!website) {
      return NextResponse.json(
        {
          success: false,
          error: "Monitored website not found."
        },
        {
          status: 400
        }
      )
    }

    try {
      targetDomain =
        new URL(website.url).hostname.replace(/^www\./, "")
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Monitored website has an invalid URL."
        },
        {
          status: 400
        }
      )
    }

    monitoredWebsiteId = website.id

  } else if (
    typeof input.targetDomain === "string" &&
    input.targetDomain.trim()
  ) {
    targetDomain =
      input.targetDomain
        .trim()
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .replace(/\/.*$/, "")
  }

  if (!targetDomain) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Select a monitored website or enter a target domain."
      },
      {
        status: 400
      }
    )
  }

  const insertResponse =
    await supabase
      .from("tracked_keywords")
      .insert({
        org_id: orgId,
        monitored_website_id: monitoredWebsiteId,
        keyword,
        target_domain: targetDomain
      })
      .select("id,keyword,target_domain,monitored_website_id,status,created_at")
      .single()

  if (insertResponse.error) {

    console.error(
      "Failed to create tracked keyword:",
      insertResponse.error
    )

    const isDuplicate =
      insertResponse.error.message
        .toLowerCase()
        .includes("duplicate")

    return NextResponse.json(
      {
        success: false,
        error:
          isDuplicate
            ? "This keyword and domain are already being tracked."
            : "Failed to create tracked keyword."
      },
      {
        status:
          isDuplicate ? 409 : 500
      }
    )

  }

  return NextResponse.json({
    success: true,
    data: {
      ...insertResponse.data,
      keyword_checks: []
    }
  })

}
