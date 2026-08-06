import { createServiceClient } from "@/lib/supabase/service"
import { generateGroundedCitations } from "./aiProvider"

type TrackedKeywordRow = {
  id: string
  org_id: string
  keyword: string
  target_domain: string
}

type KeywordCheckResult = {
  keyword: string
  success: boolean
  wasCited?: boolean
  citedDomains?: string[]
  error?: string
}

export type RunScheduledKeywordChecksResult =
  | {
      success: true
      total: number
      results: KeywordCheckResult[]
    }
  | {
      success: false
      error: string
    }

/**
 * Checks AI citation status for every active tracked keyword,
 * optionally scoped to one organization. Shared by the cron-secret-
 * protected scheduled endpoint (no orgId — sweeps every Pro
 * organization) and the interactive "Check Keywords Now" dashboard
 * button (orgId — only that user's own organization), mirroring
 * runMonitoredWebsiteAudits.ts so the two call sites can't drift out
 * of sync.
 *
 * Uses the service-role client throughout: this is trusted system code
 * that already had its caller's authorization checked (session + org
 * membership for the button, CRON_SECRET for the scheduler) before
 * being invoked.
 */
export async function runScheduledKeywordChecks(
  orgId?: string
): Promise<RunScheduledKeywordChecksResult> {

  const supabase = createServiceClient()

  // The unattended cron sweep (no orgId) only checks Pro orgs weekly --
  // Free tier gets manual checks only, via the interactive "Check
  // Keywords Now" button (which always passes an orgId and is
  // unaffected by this gate).
  let proOrgIds: string[] | null = null

  if (!orgId) {
    const { data: proOrgs } =
      await supabase
        .from("organizations")
        .select("id")
        .eq("plan", "pro")

    proOrgIds = (proOrgs || []).map((org) => org.id)

    if (proOrgIds.length === 0) {
      return {
        success: true,
        total: 0,
        results: []
      }
    }
  }

  let query =
    supabase
      .from("tracked_keywords")
      .select("id,org_id,keyword,target_domain")
      .eq("status", "active")

  if (orgId) {
    query = query.eq("org_id", orgId)
  } else if (proOrgIds) {
    query = query.in("org_id", proOrgIds)
  }

  const { data: keywords, error } =
    await query as {
      data: TrackedKeywordRow[] | null
      error: { message: string } | null
    }

  if (error) {
    return {
      success: false,
      error: error.message
    }
  }

  const results: KeywordCheckResult[] = []

  for (const trackedKeyword of keywords || []) {

    try {

      console.log(
        "Running scheduled keyword check:",
        trackedKeyword.keyword
      )

      const citationResult =
        await generateGroundedCitations(
          `Which websites would you recommend for: ${trackedKeyword.keyword}? Cite your sources.`
        )

      if (!citationResult) {
        throw new Error("Grounded citations request returned no result")
      }

      const wasCited =
        citationResult.citedDomains.includes(
          trackedKeyword.target_domain
        )

      const competitorDomains =
        citationResult.citedDomains.filter(
          (domain) => domain !== trackedKeyword.target_domain
        )

      const { error: insertError } =
        await supabase
          .from("keyword_checks")
          .insert({
            tracked_keyword_id: trackedKeyword.id,
            org_id: trackedKeyword.org_id,
            was_cited: wasCited,
            cited_domains: citationResult.citedDomains,
            competitor_domains: competitorDomains,
            raw_answer: citationResult.answer,
            raw_chunks: citationResult.citations
          })

      if (insertError) {
        throw new Error(insertError.message)
      }

      results.push({
        keyword: trackedKeyword.keyword,
        success: true,
        wasCited,
        citedDomains: citationResult.citedDomains
      })

    } catch (error) {

      console.error(error)

      results.push({
        keyword: trackedKeyword.keyword,
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error"
      })

    }

  }

  return {
    success: true,
    total: keywords?.length || 0,
    results
  }

}
