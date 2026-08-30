import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/utils/organizations"
import {
  checkRateLimit,
  getRequestKey
} from "@/utils/rateLimit"

export async function DELETE(
  request: Request,
  context: {
    params: Promise<{ id: string }>
  }
) {

  const rateLimit =
    await checkRateLimit({
      key: getRequestKey(
        request,
        "competitors-delete"
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

  const { id } =
    await context.params

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

  // Explicit org_id match, not just RLS -- same reasoning as every
  // other Stage 1 fix: this must only ever delete a row in the ACTIVE
  // org, never a foreign org this user happens to also belong to.
  const { error } =
    await supabase
      .from("competitors")
      .delete()
      .eq("id", id)
      .eq("org_id", orgId)

  if (error) {

    console.error(
      "Failed to remove competitor:",
      error
    )

    return NextResponse.json(
      {
        success: false,
        error: "Failed to remove competitor."
      },
      {
        status: 500
      }
    )

  }

  return NextResponse.json({
    success: true
  })

}
