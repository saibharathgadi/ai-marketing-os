/**
 * Single source of truth for plan-based usage limits. A future third
 * tier is a new key here plus a Stripe Price ID env var, never a
 * migration -- `organizations.plan` is free text with no CHECK
 * constraint.
 */
export const PLAN_LIMITS = {
  free: {
    monitoredWebsites: 1,
    trackedKeywords: 3
  },
  pro: {
    monitoredWebsites: 10,
    trackedKeywords: 25
  }
} as const

export function getPlanLimits(plan: string) {
  return (
    PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] ?? PLAN_LIMITS.free
  )
}
