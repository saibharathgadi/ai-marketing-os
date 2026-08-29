import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  getCurrentOrgId,
  getUserOrganizations
} from "@/utils/organizations"

export async function GET() {

  const supabase = await createClient()

  const [organizations, activeOrgId] = await Promise.all([
    getUserOrganizations(supabase),
    getCurrentOrgId(supabase)
  ])

  if (!activeOrgId) {
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

  return NextResponse.json({
    success: true,
    data: {
      organizations,
      activeOrgId
    }
  })

}
