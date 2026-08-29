import { checkRateLimit } from "./rateLimit"
import { sendUsageSpikeAlertEmail } from "./integrationAlerts"

const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000

// Generous ceilings, well above any plausible real usage across a
// handful of internal workspaces — this exists to catch a runaway bug
// (an infinite retry loop, a crawl stuck looping), not to constrain
// legitimate internal use. The `internal` plan is meant to leave usage
// unconstrained; this is passive observability with one active alert,
// not a second rate limiter.
const INTERNAL_ALERT_THRESHOLDS = {
  "ai-calls": 200,
  "crawl-pages": 500
} as const

type MonitoredResource = keyof typeof INTERNAL_ALERT_THRESHOLDS

/**
 * Call this from an `internal`-plan org's AI-generation and crawl code
 * paths. No-ops immediately for every non-internal plan, so it costs a
 * real request only for the two workspaces it's meant to watch.
 */
export async function checkInternalUsageAndAlert({
  plan,
  orgId,
  orgName,
  resource
}: {
  plan: string
  orgId: string
  orgName: string
  resource: MonitoredResource
}): Promise<void> {

  if (plan !== "internal") {
    return
  }

  const limit = INTERNAL_ALERT_THRESHOLDS[resource]

  const usage =
    await checkRateLimit({
      key: `internal-usage-alert:${resource}:${orgId}`,
      limit,
      windowMs: DAILY_WINDOW_MS
    })

  if (usage.allowed) {
    return
  }

  // The usage counter alone can't distinguish "just crossed the
  // threshold" from "the 200th call past it" — both report the same
  // allowed:false. A second, independent limit-of-1 check on its own
  // key acts as a one-time claim: only the first caller to hit this
  // point in the current window gets allowed:true back, so the email
  // fires exactly once per day even though the usage check itself
  // keeps returning allowed:false for every call after the first.
  const alertClaim =
    await checkRateLimit({
      key: `internal-usage-alerted:${resource}:${orgId}`,
      limit: 1,
      windowMs: DAILY_WINDOW_MS
    })

  if (alertClaim.allowed) {
    await sendUsageSpikeAlertEmail({
      orgName,
      resource,
      count: limit
    })
  }

}
