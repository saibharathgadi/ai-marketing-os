import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/utils/organizations"

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

  const {
    data: { user }
  } = await supabase.auth.getUser()

  // RLS alone isn't enough to scope this to "the current workspace's
  // team" — since Phase 1, a gated user can belong to more than one
  // org, and RLS legitimately allows them to see membership/invite rows
  // across every org they're in, not just the active one. Without this
  // explicit org_id filter, a multi-org user's Team page showed a
  // mashed-together union of both orgs' rows (their own membership
  // appearing twice, once per org, with different roles), which in turn
  // made currentUserRole below pick whichever org's row happened to
  // sort first — showing owner-only actions (like "Invite a teammate")
  // even while viewing a workspace where they're only a member.
  const { data: members, error: membersError } =
    await supabase
      .from("organization_members")
      .select("id,user_id,email,role,created_at")
      .eq("org_id", orgId)
      .order("created_at", {
        ascending: true
      })

  if (membersError) {

    console.error(
      "Failed to list team members:",
      membersError
    )

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load team."
      },
      {
        status: 500
      }
    )

  }

  // Pending invites are owner-only via RLS — a non-owner's query
  // simply returns an empty array here, not an error. Same org_id
  // scoping issue as members above applies here too.
  const { data: invites } =
    await supabase
      .from("organization_invites")
      .select("id,email,status,created_at,expires_at")
      .eq("org_id", orgId)
      .eq("status", "pending")
      .order("created_at", {
        ascending: false
      })

  const currentUserRole =
    members?.find((member) => member.user_id === user?.id)?.role ??
    "member"

  return NextResponse.json({
    success: true,
    data: {
      members: members || [],
      invites: invites || [],
      currentUserRole
    }
  })

}
