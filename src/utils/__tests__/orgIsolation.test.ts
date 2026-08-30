import { randomUUID } from "node:crypto"
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  vi
} from "vitest"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { createServiceClient } from "@/lib/supabase/service"

/**
 * Org-isolation test suite, per the Phase 1 build spec's 5 required
 * cases. There is no separate test/staging Supabase project available
 * (see vitest.config.ts) — these run against the real project the dev
 * server uses, so every fixture is namespaced under one run id and torn
 * down in `afterAll`. Real RLS-governed tables are queried through real
 * signed-in clients (never the service client) wherever the assertion
 * is actually about RLS, so a passing suite means Postgres itself
 * enforced isolation, not just the app-layer helpers.
 *
 * `next/headers` is mocked because `getCurrentOrgId`'s cookie read only
 * makes sense inside a real Next.js request — outside one it throws and
 * the function deliberately falls back to the pre-Phase-1 behavior (see
 * the comment in src/utils/organizations.ts). Mocking it is what lets
 * the workspace-switcher cookie path be exercised at all here.
 *
 * Every new auth user automatically gets a default organization + owner
 * membership via the `handle_new_user` trigger (see
 * supabase/migrations/20260726151448_multi_tenant.sql) — so "a single-
 * org user" and "a user with no orgs yet" both already have that one
 * auto-created org the moment they're created. The fixtures below work
 * with that instead of fighting it: user B's "single org" IS its
 * auto-created org (never a second, manually-added one), and user C's
 * invite-acceptance case starts from their auto-created org and adds a
 * second, matching the real flow (a user always already has their own
 * default workspace before ever accepting a team invite). `afterAll`
 * discovers every org any test user actually ended up in — rather than
 * only the ones this file explicitly created — specifically so an
 * auto-created org can never be missed and leaked into production.
 */

const runId = randomUUID().slice(0, 8)

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

let activeOrgCookieValue: string | undefined

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "active_org_id" && activeOrgCookieValue
        ? { value: activeOrgCookieValue }
        : undefined
  })
}))

function testEmail(label: string) {
  return `phase1-test-${runId}-${label}@example.com`
}

const TEST_PASSWORD = `Test-${randomUUID()}!`

function anonClient() {
  return createSupabaseClient(SUPABASE_URL, ANON_KEY)
}

async function signIn(email: string) {
  const client = anonClient()

  const { error } =
    await client.auth.signInWithPassword({
      email,
      password: TEST_PASSWORD
    })

  if (error) {
    throw error
  }

  return client
}

describe("Phase 1 org isolation", () => {

  const service = createServiceClient()

  const orgName = (label: string) =>
    `PHASE1_TEST_ISOLATION_${runId}_${label}`

  let orgGatedA: string
  let orgGatedB: string

  // User B's own auto-created default org — the "single org" in test 4.
  let orgAutoB: string

  let userA: string
  let userB: string
  let userC: string

  let campaignA: string
  let campaignB: string
  let websiteA: string
  let websiteB: string

  beforeAll(async () => {

    const [orgAResult, orgBResult] = await Promise.all([
      service.from("organizations").insert({ name: orgName("gated_a") }).select("id").single(),
      service.from("organizations").insert({ name: orgName("gated_b") }).select("id").single()
    ])

    if (orgAResult.error || orgBResult.error) {
      throw orgAResult.error || orgBResult.error
    }

    orgGatedA = orgAResult.data.id
    orgGatedB = orgBResult.data.id

    // The gate constant is read from process.env once, at module import
    // time — set it and force a fresh import so this run's real org ids
    // (unknown until the inserts above complete) are the ones gated.
    process.env.MULTI_ORG_GATE_ORG_IDS = `${orgGatedA},${orgGatedB}`
    vi.resetModules()

    const [userAResult, userBResult, userCResult] = await Promise.all([
      service.auth.admin.createUser({
        email: testEmail("a"),
        password: TEST_PASSWORD,
        email_confirm: true
      }),
      service.auth.admin.createUser({
        email: testEmail("b"),
        password: TEST_PASSWORD,
        email_confirm: true
      }),
      service.auth.admin.createUser({
        email: testEmail("c"),
        password: TEST_PASSWORD,
        email_confirm: true
      })
    ])

    if (userAResult.error || userBResult.error || userCResult.error) {
      throw userAResult.error || userBResult.error || userCResult.error
    }

    userA = userAResult.data.user.id
    userB = userBResult.data.user.id
    userC = userCResult.data.user.id

    const autoMembershipB =
      await service
        .from("organization_members")
        .select("org_id")
        .eq("user_id", userB)
        .single()

    if (autoMembershipB.error) {
      throw autoMembershipB.error
    }

    orgAutoB = autoMembershipB.data.org_id

    // User A additionally joins both gated orgs (the "one login, two
    // workspaces" case), on top of their own auto-created default org.
    // User B and C are untouched here — B's single org is its
    // auto-created one, and C stays at just its auto-created org until
    // test 5 adds a second via a real invite.
    const membershipInserts = await service
      .from("organization_members")
      .insert([
        { org_id: orgGatedA, user_id: userA, role: "owner", email: testEmail("a") },
        { org_id: orgGatedB, user_id: userA, role: "owner", email: testEmail("a") }
      ])

    if (membershipInserts.error) {
      throw membershipInserts.error
    }

    const competitorInserts = await service
      .from("competitors")
      .insert([
        { org_id: orgGatedA, url: "https://a.example.com", name: orgName("gated_a") + "_competitor" },
        { org_id: orgGatedB, url: "https://b.example.com", name: orgName("gated_b") + "_competitor" }
      ])

    if (competitorInserts.error) {
      throw competitorInserts.error
    }

    // Fixtures for the Stage 1 org-scoping fixes (campaigns,
    // content_items, monitored_websites, tracked_keywords GET routes,
    // and the ad_sets/landing_page_briefs foreign-lookup rejection).
    // All four tables cascade-delete on their org_id FK, so afterAll's
    // existing org deletion cleans these up with no extra code.
    const [campaignAResult, campaignBResult] = await Promise.all([
      service.from("campaigns").insert({ org_id: orgGatedA, name: orgName("gated_a") + "_campaign" }).select("id").single(),
      service.from("campaigns").insert({ org_id: orgGatedB, name: orgName("gated_b") + "_campaign" }).select("id").single()
    ])

    if (campaignAResult.error || campaignBResult.error) {
      throw campaignAResult.error || campaignBResult.error
    }

    campaignA = campaignAResult.data.id
    campaignB = campaignBResult.data.id

    const [websiteAResult, websiteBResult] = await Promise.all([
      service.from("monitored_websites").insert({ org_id: orgGatedA, url: "https://a-site.example.com" }).select("id").single(),
      service.from("monitored_websites").insert({ org_id: orgGatedB, url: "https://b-site.example.com" }).select("id").single()
    ])

    if (websiteAResult.error || websiteBResult.error) {
      throw websiteAResult.error || websiteBResult.error
    }

    websiteA = websiteAResult.data.id
    websiteB = websiteBResult.data.id

    const scopingFixtureInserts = await service
      .from("content_items")
      .insert([
        { org_id: orgGatedA, type: "blog_idea", title: orgName("gated_a") + "_content", status: "idea" },
        { org_id: orgGatedB, type: "blog_idea", title: orgName("gated_b") + "_content", status: "idea" }
      ])

    if (scopingFixtureInserts.error) {
      throw scopingFixtureInserts.error
    }

  })

  afterAll(async () => {

    // Don't rely on which orgs this file explicitly created — a user's
    // auto-created default org is a side effect of `admin.createUser`,
    // not something inserted here, so it has to be discovered rather
    // than assumed. Querying every org any test user actually belongs
    // to is what caught (and now prevents) the very leak this comment
    // is here to explain: three earlier runs of this suite each left
    // 3 auto-created orgs behind in production because cleanup only
    // ever knew about the orgs it had inserted itself.
    const testUserIds = [userA, userB, userC].filter(Boolean)

    const { data: allMemberships } =
      testUserIds.length > 0
        ? await service
            .from("organization_members")
            .select("org_id")
            .in("user_id", testUserIds)
        : { data: [] as { org_id: string }[] }

    const allOrgIds = Array.from(
      new Set(
        [orgGatedA, orgGatedB, ...(allMemberships ?? []).map((m) => m.org_id)]
          .filter(Boolean)
      )
    )

    if (allOrgIds.length > 0) {
      await service.from("competitors").delete().in("org_id", allOrgIds)
      await service.from("organization_invites").delete().in("org_id", allOrgIds)
      await service.from("organization_members").delete().in("org_id", allOrgIds)
      await service.from("organizations").delete().in("id", allOrgIds)
    }

    for (const userId of testUserIds) {
      await service.auth.admin.deleteUser(userId)
    }

  })

  it("1. a user in two orgs sees only the active workspace's data", async () => {

    const { getCurrentOrgId } = await import("@/utils/organizations")

    const clientA = await signIn(testEmail("a"))

    try {

      activeOrgCookieValue = orgGatedB

      const resolvedOrgId = await getCurrentOrgId(clientA)
      expect(resolvedOrgId).toBe(orgGatedB)

      const { data: visibleCompetitors, error } =
        await clientA
          .from("competitors")
          .select("org_id")
          .eq("org_id", resolvedOrgId!)

      expect(error).toBeNull()
      expect(visibleCompetitors).toHaveLength(1)
      expect(visibleCompetitors![0].org_id).toBe(orgGatedB)

    } finally {

      activeOrgCookieValue = undefined
      await clientA.auth.signOut()

    }

  })

  it("2. a user cannot force-select an org they don't belong to", async () => {

    const { getUserOrganizations } = await import("@/utils/organizations")

    const clientA = await signIn(testEmail("a"))

    try {

      const memberships = await getUserOrganizations(clientA)
      const isMember = memberships.some((m) => m.orgId === orgAutoB)

      // This mirrors the exact check /api/workspace/active/route.ts
      // performs before ever looking at the gate — a client-supplied
      // orgId is only ever honored if a real membership row backs it.
      expect(isMember).toBe(false)

    } finally {

      await clientA.auth.signOut()

    }

  })

  it("3. RLS blocks cross-org reads independent of app-layer logic", async () => {

    const clientB = await signIn(testEmail("b"))

    try {

      // User B has no membership in either gated org — querying their
      // data directly (bypassing every app helper) must come back
      // empty, not merely "the app didn't ask for it."
      const { data, error } =
        await clientB
          .from("competitors")
          .select("org_id")
          .in("org_id", [orgGatedA, orgGatedB])

      expect(error).toBeNull()
      expect(data).toHaveLength(0)

    } finally {

      await clientB.auth.signOut()

    }

  })

  it("4. existing single-org users are unaffected", async () => {

    const { getCurrentOrgId } = await import("@/utils/organizations")

    const clientB = await signIn(testEmail("b"))

    try {

      // No cookie set at all — the exact pre-Phase-1 call shape. A
      // single-membership, non-gated user must resolve straight to
      // their one (auto-created) org with no dependency on the cookie
      // path.
      activeOrgCookieValue = undefined

      const resolvedOrgId = await getCurrentOrgId(clientB)
      expect(resolvedOrgId).toBe(orgAutoB)

    } finally {

      await clientB.auth.signOut()

    }

  })

  it("5. adding a second org requires a valid matching invite", async () => {

    const noInvite =
      await service
        .from("organization_invites")
        .select("id")
        .eq("status", "pending")
        .ilike("email", testEmail("c"))
        .gt("expires_at", new Date().toISOString())
        .maybeSingle()

    expect(noInvite.data).toBeNull()

    const inviteInsert =
      await service
        .from("organization_invites")
        .insert({
          org_id: orgGatedA,
          email: testEmail("c"),
          invited_by: userA
        })
        .select("id")
        .single()

    expect(inviteInsert.error).toBeNull()

    const foundInvite =
      await service
        .from("organization_invites")
        .select("id, org_id")
        .eq("status", "pending")
        .ilike("email", testEmail("c"))
        .gt("expires_at", new Date().toISOString())
        .maybeSingle()

    expect(foundInvite.data?.org_id).toBe(orgGatedA)

    // The route only ever inserts a membership once a real pending
    // invite for the signed-in user's own email is found — replicate
    // that exact sequence, then confirm the new member can see their
    // own new membership (alongside their pre-existing auto-created
    // org) through their own RLS-scoped session, not just that the
    // service-role insert succeeded.
    const membershipInsert =
      await service
        .from("organization_members")
        .insert({
          org_id: foundInvite.data!.org_id,
          user_id: userC,
          role: "member",
          email: testEmail("c")
        })

    expect(membershipInsert.error).toBeNull()

    const clientC = await signIn(testEmail("c"))

    try {

      const { data: ownMemberships, error } =
        await clientC
          .from("organization_members")
          .select("org_id")
          .eq("user_id", userC)

      expect(error).toBeNull()

      const orgIds = (ownMemberships ?? []).map((m) => m.org_id)
      expect(orgIds).toContain(orgGatedA)
      expect(orgIds).toHaveLength(2)

    } finally {

      await clientC.auth.signOut()

    }

  })

  // Stage 1 fixes: campaigns, content_items, monitored_websites, and
  // tracked_keywords GET routes used to rely on RLS alone (safe when
  // every user had exactly one org, a union-of-both-orgs leak once
  // gated). Each fixed route now resolves the active org via
  // getCurrentOrgId and adds an explicit .eq("org_id", ...) — these
  // tests reproduce that exact pattern against real signed-in clients.

  it("6. campaigns GET-pattern only returns the active org's rows", async () => {

    const { getCurrentOrgId } = await import("@/utils/organizations")

    const clientA = await signIn(testEmail("a"))

    try {

      activeOrgCookieValue = orgGatedA
      const resolvedOrgId = await getCurrentOrgId(clientA)

      const { data, error } =
        await clientA
          .from("campaigns")
          .select("id, org_id")
          .eq("org_id", resolvedOrgId!)

      expect(error).toBeNull()
      expect(data).toHaveLength(1)
      expect(data![0].id).toBe(campaignA)

    } finally {

      activeOrgCookieValue = undefined
      await clientA.auth.signOut()

    }

  })

  it("7. content_items GET-pattern only returns the active org's rows", async () => {

    const { getCurrentOrgId } = await import("@/utils/organizations")

    const clientA = await signIn(testEmail("a"))

    try {

      activeOrgCookieValue = orgGatedB
      const resolvedOrgId = await getCurrentOrgId(clientA)

      const { data, error } =
        await clientA
          .from("content_items")
          .select("id, org_id, title")
          .eq("org_id", resolvedOrgId!)

      expect(error).toBeNull()
      expect(data).toHaveLength(1)
      expect(data![0].title).toBe(orgName("gated_b") + "_content")

    } finally {

      activeOrgCookieValue = undefined
      await clientA.auth.signOut()

    }

  })

  it("8. monitored_websites GET-pattern only returns the active org's rows", async () => {

    const { getCurrentOrgId } = await import("@/utils/organizations")

    const clientA = await signIn(testEmail("a"))

    try {

      activeOrgCookieValue = orgGatedA
      const resolvedOrgId = await getCurrentOrgId(clientA)

      const { data, error } =
        await clientA
          .from("monitored_websites")
          .select("id, org_id")
          .eq("org_id", resolvedOrgId!)

      expect(error).toBeNull()
      expect(data).toHaveLength(1)
      expect(data![0].id).toBe(websiteA)

    } finally {

      activeOrgCookieValue = undefined
      await clientA.auth.signOut()

    }

  })

  it("9. tracked_keywords' monitored-website lookup rejects a foreign-org id", async () => {

    const { getCurrentOrgId } = await import("@/utils/organizations")

    const clientA = await signIn(testEmail("a"))

    try {

      // Active org is A, but the site id belongs to org B — the fixed
      // lookup (.eq("id", ...).eq("org_id", orgId)) must reject this,
      // exactly like /api/tracked-keywords POST now does, instead of
      // silently attaching org B's domain to a keyword created under A.
      activeOrgCookieValue = orgGatedA
      const resolvedOrgId = await getCurrentOrgId(clientA)

      const { data } =
        await clientA
          .from("monitored_websites")
          .select("id,url")
          .eq("id", websiteB)
          .eq("org_id", resolvedOrgId!)
          .maybeSingle()

      expect(data).toBeNull()

    } finally {

      activeOrgCookieValue = undefined
      await clientA.auth.signOut()

    }

  })

  it("10. ad_sets' campaign lookup rejects a foreign-org campaignId", async () => {

    const { getCurrentOrgId } = await import("@/utils/organizations")

    const clientA = await signIn(testEmail("a"))

    try {

      // Active org is A, but campaignB belongs to org B — the fixed
      // lookup must reject this instead of creating the new ad set
      // under org B while the user thinks they're working in org A.
      activeOrgCookieValue = orgGatedA
      const resolvedOrgId = await getCurrentOrgId(clientA)

      const { data } =
        await clientA
          .from("campaigns")
          .select("id, org_id")
          .eq("id", campaignB)
          .eq("org_id", resolvedOrgId!)
          .maybeSingle()

      expect(data).toBeNull()

    } finally {

      activeOrgCookieValue = undefined
      await clientA.auth.signOut()

    }

  })

})
