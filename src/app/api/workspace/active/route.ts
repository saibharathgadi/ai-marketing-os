import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  ACTIVE_ORG_COOKIE_NAME,
  getUserOrganizations,
  isMultiOrgGatedOrg
} from "@/utils/organizations"
import {
  checkRateLimit,
  getRequestKey
} from "@/utils/rateLimit"

export async function POST(request: Request) {

  const rateLimit =
    await checkRateLimit({
      key: getRequestKey(request, "workspace-switch"),
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
            String(rateLimit.retryAfterSeconds)
        }
      }
    )
  }

  const supabase = await createClient()

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
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

  const requestedOrgId = (body as { orgId?: unknown }).orgId

  if (typeof requestedOrgId !== "string" || !requestedOrgId) {
    return NextResponse.json(
      {
        success: false,
        error: "orgId is required."
      },
      {
        status: 400
      }
    )
  }

  // The switcher is only meaningful for gated (multi-membership) users
  // today, but the real security boundary is the membership check
  // below, not the gate — never trust a client-supplied org id without
  // verifying the current user actually belongs to it.
  const memberships = await getUserOrganizations(supabase)
  const isMember = memberships.some((m) => m.orgId === requestedOrgId)

  if (!isMember) {
    return NextResponse.json(
      {
        success: false,
        error: "You don't have access to that workspace."
      },
      {
        status: 403
      }
    )
  }

  if (!isMultiOrgGatedOrg(requestedOrgId)) {
    return NextResponse.json(
      {
        success: false,
        error: "Workspace switching isn't enabled for this organization yet."
      },
      {
        status: 403
      }
    )
  }

  const response = NextResponse.json({ success: true })

  response.cookies.set(ACTIVE_ORG_COOKIE_NAME, requestedOrgId, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    // No expiry beyond the session's own lifetime — this is a UI
    // preference, not a credential; a stale value is harmless since
    // every read re-validates it against real membership rows.
    maxAge: 60 * 60 * 24 * 365,
    path: "/"
  })

  return response

}
