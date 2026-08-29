import type { SupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

const ACTIVE_ORG_COOKIE = "active_org_id"

// TEMPORARY ROLLOUT GATE — Phase 1 build spec §02.
//
// Multi-org resolution below is written to be fully generic; this gate
// only decides *which users* it's switched on for during the rollout.
// Populate MULTI_ORG_GATE_ORG_IDS (comma-separated org ids) with
// EasyStepIn's and Elev8's real organization ids once they exist. Every
// other org keeps the exact single-membership behavior this file had
// before Phase 1, with no change in query shape or result.
//
// Remove this constant, the `gateActiveForThisUser` check inside
// getCurrentOrgId, and this comment entirely once the Phase 1 removal
// criteria are met (7 days of real use across both gated orgs, the
// org-isolation test suite green, zero cross-tenant issues found) — at
// that point every user gets multi-org resolution unconditionally, with
// no other code change required.
const MULTI_ORG_GATE_ORG_IDS = new Set(
  (process.env.MULTI_ORG_GATE_ORG_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
)

export type OrganizationMembership = {
  orgId: string
  role: string
  orgName: string
}

/**
 * All organizations the current user belongs to, for the workspace
 * switcher. Works the same for every user regardless of the rollout
 * gate above — a user with exactly one membership just gets a
 * one-item list back.
 */
export async function getUserOrganizations(
  supabase: SupabaseClient
): Promise<OrganizationMembership[]> {

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  const { data, error } =
    await supabase
      .from("organization_members")
      .select("org_id, role, organizations(name)")
      .eq("user_id", user.id)

  if (error || !data) {
    return []
  }

  return data.map((row) => {
    const org = row.organizations as unknown as { name: string } | null

    return {
      orgId: row.org_id as string,
      role: row.role as string,
      orgName: org?.name ?? "Untitled organization"
    }
  })

}

/**
 * Resolves the "active" organization for the current request.
 *
 * For any user not covered by the temporary rollout gate above, this
 * behaves exactly as it always has: the user's one membership, full
 * stop. For a gated user with more than one membership, it additionally
 * honors a stored workspace-switcher preference (a cookie, validated
 * against real membership rows on every call — a stale or tampered
 * cookie value that isn't an actual membership is simply ignored, never
 * trusted on its own).
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

  const { data: memberships } =
    await supabase
      .from("organization_members")
      .select("org_id")
      .eq("user_id", user.id)

  const orgIds = (memberships ?? []).map(
    (row) => row.org_id as string
  )

  if (orgIds.length === 0) {
    return null
  }

  const gateActiveForThisUser =
    orgIds.some((id) => MULTI_ORG_GATE_ORG_IDS.has(id))

  if (!gateActiveForThisUser) {
    return orgIds[0]
  }

  try {

    const cookieStore = await cookies()
    const activeOrgId =
      cookieStore.get(ACTIVE_ORG_COOKIE)?.value

    if (activeOrgId && orgIds.includes(activeOrgId)) {
      return activeOrgId
    }

  } catch {

    // cookies() can throw outside a request context — fall through to
    // the default below rather than fail the whole lookup.

  }

  return orgIds[0]

}

export function isMultiOrgGatedOrg(orgId: string): boolean {
  return MULTI_ORG_GATE_ORG_IDS.has(orgId)
}

export const ACTIVE_ORG_COOKIE_NAME = ACTIVE_ORG_COOKIE

/**
 * Looks up an org's plan and display name in one query — the two fields
 * `checkInternalUsageAndAlert` needs at AI-generation and crawl call
 * sites that only otherwise have an orgId in scope. Accepts either an
 * RLS-scoped client (a member reading their own org) or the service
 * client (background jobs with no session), since both expose the same
 * `organizations` table shape.
 */
export async function getOrgPlanAndName(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ plan: string; name: string }> {

  const { data } =
    await supabase
      .from("organizations")
      .select("plan, name")
      .eq("id", orgId)
      .maybeSingle()

  return {
    plan: (data?.plan as string) ?? "free",
    name: (data?.name as string) ?? "Untitled organization"
  }

}
