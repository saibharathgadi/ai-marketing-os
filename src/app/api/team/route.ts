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

  // No manual org_id filter needed here — RLS restricts the result set
  // to rows in organizations the current session's user belongs to.
  const { data: members, error: membersError } =
    await supabase
      .from("organization_members")
      .select("id,user_id,email,role,created_at")
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
  // simply returns an empty array here, not an error.
  const { data: invites } =
    await supabase
      .from("organization_invites")
      .select("id,email,status,created_at,expires_at")
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
