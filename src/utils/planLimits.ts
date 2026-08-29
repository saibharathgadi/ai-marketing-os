/**
 * Single source of truth for plan-based usage limits. A future third
 * tier is a new key here plus a Stripe Price ID env var, never a
 * migration -- `organizations.plan` is free text with no CHECK
 * constraint.
 */
export const PLAN_LIMITS = {
  free: {
    monitoredWebsites: 1,
    trackedKeywords: 3,
    teamSeats: 1
  },
  pro: {
    monitoredWebsites: 10,
    trackedKeywords: 25,
    teamSeats: 5
  },
  // No Verolyx subscription — for orgs we run ourselves (EasyStepIn,
  // Elev8) rather than a customer's. Limits are generous, not absent:
  // real usage should never be constrained, but a runaway bug shouldn't
  // have an unlimited blast radius either. Cost control for this tier
  // happens via src/utils/internalUsageMonitor.ts's alert threshold, not
  // via these plan limits — set plan = 'internal' directly on an
  // organizations row (no Stripe checkout involved) to grant it.
  internal: {
    monitoredWebsites: 50,
    trackedKeywords: 200,
    teamSeats: 10
  }
} as const

export function getPlanLimits(plan: string) {
  return (
    PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] ?? PLAN_LIMITS.free
  )
}
