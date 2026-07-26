import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function DELETE(
  request: Request,
  context: {
    params: Promise<{ id: string }>
  }
) {

  const { id } =
    await context.params

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