import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
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

  // integration_connections has no RLS policy for the authenticated
  // role at all (service-role only, by design — the same pattern as
  // rate_limit_counters/audit_queue_*), so this has to go through the
  // service client with an explicit, manual org_id filter. Only
  // non-secret metadata is selected — the token columns are never
  // read here, let alone returned to the browser.
  const serviceClient = createServiceClient()

  const { data, error } =
    await serviceClient
      .from("integration_connections")
      .select("provider, expires_at, created_at, updated_at")
      .eq("org_id", orgId)

  if (error) {

    console.error(
      "Failed to load integration connections:",
      error
    )

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load integrations."
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
