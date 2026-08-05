import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function DELETE(
  request: Request,
  context: {
    params: Promise<{ id: string }>
  }
) {

  const { id } =
    await context.params

  const supabase = await createClient()

  // RLS delete policies on crawled_pages/audits already restrict this
  // to rows belonging to organizations the current user is a member of.
  const { error: crawledPagesError } =
    await supabase
      .from("crawled_pages")
      .delete()
      .eq("audit_id", id)

  if (crawledPagesError) {

    console.error(
      "Failed to delete crawled pages for audit:",
      crawledPagesError
    )

    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete audit."
      },
      {
        status: 500
      }
    )

  }

  const { data, error } =
    await supabase
      .from("audits")
      .delete()
      .eq("id", id)
      .select("id")

  if (error) {

    console.error(
      "Failed to delete audit:",
      error
    )

    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete audit."
      },
      {
        status: 500
      }
    )

  }

  // RLS silently filters out rows the caller isn't allowed to delete
  // rather than raising an error — .delete() with no matching rows
  // still returns error: null, so `data` is the only signal that
  // nothing actually happened. Without this check, a delete the RLS
  // policy refused looks identical to a successful one.
  if (!data || data.length === 0) {

    return NextResponse.json(
      {
        success: false,
        error: "Audit not found, or you don't have permission to delete it."
      },
      {
        status: 404
      }
    )

  }

  return NextResponse.json({
    success: true
  })

}