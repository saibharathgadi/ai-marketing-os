import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Resolves the organization the currently-authenticated user (per the
 * given session-bound client) belongs to. Every user gets exactly one
 * personal organization automatically on signup (see the
 * handle_new_user trigger in supabase/migrations); multi-org
 * membership/switching is a fast-follow feature, not v1.
 *
 * Returns null if there's no session or no membership row yet.
 */
export async function getCurrentOrgId(
  supabase: SupabaseClient
): Promise<string | null> {
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data } =
    await supabase
      .from("organization_members")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle()

  return data?.org_id ?? null
}
