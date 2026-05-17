import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { validateWebsiteUrl } from "@/utils/urlValidation"

export async function GET() {

  const { data, error } =
    await supabase
      .from("monitored_websites")
      .select("id,url,last_audited_at,created_at")
      .order("created_at", {
        ascending: false
      })

  if (error) {

    return NextResponse.json(
      {
        success: false,
        error: error.message
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

export async function POST(
  request: Request
) {

  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      {
        success: false,
        error:
          "Request body must be valid JSON."
      },
      {
        status: 400
      }
    )
  }

  const urlValidation =
    validateWebsiteUrl(
      (body as { url?: unknown }).url
    )

  if (!urlValidation.success) {
    return NextResponse.json(
      {
        success: false,
        error: urlValidation.error
      },
      {
        status: 400
      }
    )
  }

  const { data, error } =
    await supabase
      .from("monitored_websites")
      .insert({
        url: urlValidation.url
      })
      .select()
      .single()

  if (error) {

    return NextResponse.json(
      {
        success: false,
        error: error.message
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
