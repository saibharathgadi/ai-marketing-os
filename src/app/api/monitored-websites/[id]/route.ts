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
        "monitored-websites-delete"
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

  // No manual org ownership check needed — the RLS delete policy on
  // monitored_websites already restricts this to rows in organizations
  // the current session's user belongs to.
  const { error } =
    await supabase
      .from("monitored_websites")
      .delete()
      .eq("id", id)

  if (error) {

    console.error(
      "Failed to delete monitored website:",
      error
    )

    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete monitored website."
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