import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isSafeRedirectPath } from "@/lib/utils"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next")
  const redirectTarget = isSafeRedirectPath(next) ? next : "/dashboard"

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(`${origin}${redirectTarget}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`)
}
