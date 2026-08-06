import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
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
        "team-members-delete"
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

  // No manual owner check needed — RLS already restricts this to the
  // org's owner removing a 'member' row (never an 'owner' row).
  const { error } =
    await supabase
      .from("organization_members")
      .delete()
      .eq("id", id)

  if (error) {

    console.error(
      "Failed to remove team member:",
      error
    )

    return NextResponse.json(
      {
        success: false,
        error: "Failed to remove team member."
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
