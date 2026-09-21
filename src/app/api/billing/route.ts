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

  // Explicit org_id filter, not RLS alone: a gated multi-org user's RLS
  // visibility spans every org they belong to, so an unfiltered
  // .single() here would error (multiple rows) for exactly that user —
  // see the same pattern/comment in tracked-keywords/route.ts's GET.
  const { data, error } =
    await supabase
      .from("organizations")
      .select("plan,subscription_status,trial_ends_at,current_period_end")
      .eq("id", orgId)
      .single()

  if (error || !data) {

    console.error(
      "Failed to load billing info:",
      error
    )

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load billing information."
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
