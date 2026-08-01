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

  const { error } =
    await supabase
      .from("audits")
      .delete()
      .eq("id", id)

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

  return NextResponse.json({
    success: true
  })

}