import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/utils/organizations"
import { getPlanLimits } from "@/utils/planLimits"
import { validateReportRecipient } from "@/utils/emailReport"
import { sendTeamInviteEmail } from "@/utils/teamInviteEmail"
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
        "team-invites-create"
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

  const {
    data: { user }
  } = await supabase.auth.getUser()

  const orgResponse =
    await supabase
      .from("organizations")
      .select("name,plan")
      .eq("id", orgId)
      .single()

  const plan = orgResponse.data?.plan ?? "free"
  const orgName = orgResponse.data?.name ?? "the team"

  const { count: memberCount } =
    await supabase
      .from("organization_members")
      .select("*", {
        count: "exact",
        head: true
      })
      .eq("org_id", orgId)

  const { count: pendingInviteCount } =
    await supabase
      .from("organization_invites")
      .select("*", {
        count: "exact",
        head: true
      })
      .eq("org_id", orgId)
      .eq("status", "pending")

  const seatsUsed =
    (memberCount ?? 0) + (pendingInviteCount ?? 0)

  if (seatsUsed >= getPlanLimits(plan).teamSeats) {
    return NextResponse.json(
      {
        success: false,
        error:
          plan === "pro"
            ? "You've reached your plan's team seat limit."
            : "Team invites require Pro. Upgrade to invite teammates."
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

  const email =
    typeof (body as { email?: unknown }).email === "string"
      ? (body as { email: string }).email.trim()
      : ""

  if (!validateReportRecipient(email)) {
    return NextResponse.json(
      {
        success: false,
        error: "Please enter a valid email address."
      },
      {
        status: 400
      }
    )
  }

  const insertResponse =
    await supabase
      .from("organization_invites")
      .insert({
        org_id: orgId,
        email,
        invited_by: user?.id
      })
      .select("id,email,status,created_at,expires_at")
      .single()

  if (insertResponse.error) {

    console.error(
      "Failed to create team invite:",
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
            ? "There's already a pending invite for this email."
            : "Failed to create invite."
      },
      {
        status:
          isDuplicate ? 409 : 500
      }
    )

  }

  const emailResult =
    await sendTeamInviteEmail({
      to: email,
      orgName,
      inviterEmail: user?.email ?? "A teammate"
    })

  if (!emailResult.success) {
    console.error(
      "Failed to send team invite email:",
      emailResult.error
    )
  }

  return NextResponse.json({
    success: true,
    data: insertResponse.data,
    emailSent: emailResult.success
  })

}
