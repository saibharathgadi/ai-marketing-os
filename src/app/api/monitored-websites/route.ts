import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET() {

  const { data, error } =
    await supabase
      .from("monitored_websites")
      .select("*")
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

  const body =
    await request.json()

  const { url } = body

  const { data, error } =
    await supabase
      .from("monitored_websites")
      .insert({
        url
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