import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import {
  checkRateLimit,
  getRequestKey
} from "@/utils/rateLimit"

/**
 * Accepts a pending invite for a user who is ALREADY signed in — the
 * one gap the existing invite flow has, since handle_new_user only ever
 * fires on brand-new signup. This is what lets a single person end up
 * as a member of more than one organization (e.g. the same login
 * operating both EasyStepIn and Elev8 as separate workspaces).
 *
 * Deliberately narrow: it only ever inserts a membership row when a
 * real, pending, non-expired invite exists for the current user's own
 * email — there is no path here that lets a user add themselves to an
 * organization without one.
 */
export async function POST(request: Request) {

  const rateLimit =
    await checkRateLimit({
      key: getRequestKey(request, "team-invites-accept"),
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
            String(rateLimit.retryAfterSeconds)
        }
      }
    )
  }

  const supabase = await createClient()

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user || !user.email) {
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

  const serviceClient = createServiceClient()

  const { data: invite, error: inviteError } =
    await serviceClient
      .from("organization_invites")
      .select("id, org_id, role")
      .eq("status", "pending")
      .ilike("email", user.email)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

  if (inviteError || !invite) {
    return NextResponse.json(
      {
        success: false,
        error:
          "No pending invite was found for your email address."
      },
      {
        status: 404
      }
    )
  }

  const { data: existingMembership } =
    await serviceClient
      .from("organization_members")
      .select("id")
      .eq("org_id", invite.org_id)
      .eq("user_id", user.id)
      .maybeSingle()

  if (existingMembership) {
    return NextResponse.json(
      {
        success: false,
        error: "You're already a member of that organization."
      },
      {
        status: 409
      }
    )
  }

  const { error: membershipError } =
    await serviceClient
      .from("organization_members")
      .insert({
        org_id: invite.org_id,
        user_id: user.id,
        role: invite.role,
        email: user.email
      })

  if (membershipError) {
    console.error(
      "Failed to create membership from accepted invite:",
      membershipError
    )
    return NextResponse.json(
      {
        success: false,
        error: "Failed to accept the invite."
      },
      {
        status: 500
      }
    )
  }

  await serviceClient
    .from("organization_invites")
    .update({ status: "accepted" })
    .eq("id", invite.id)

  return NextResponse.json({
    success: true,
    data: { orgId: invite.org_id }
  })

}
