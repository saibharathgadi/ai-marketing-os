import { createServiceClient } from "@/lib/supabase/service"

type RateLimitOptions = {
  key: string
  limit: number
  windowMs: number
}

type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetAt: number
  retryAfterSeconds: number
}

export function getRequestKey(
  request: Request,
  scope: string
) {
  // Vercel overwrites this header at the edge with the real client IP,
  // so unlike x-forwarded-for/x-real-ip it cannot be spoofed by the
  // client to obtain a fresh rate-limit bucket on every request.
  const vercelForwardedFor =
    request.headers
      .get("x-vercel-forwarded-for")
      ?.split(",")[0]
      ?.trim()

  const forwardedFor =
    request.headers
      .get("x-forwarded-for")
      ?.split(",")[0]
      ?.trim()

  const realIp =
    request.headers.get("x-real-ip")?.trim()

  return `${scope}:${vercelForwardedFor || forwardedFor || realIp || "unknown"}`
}

// Backed by the check_rate_limit Postgres function (single atomic
// upsert -- see the durable-rate-limit migration) instead of a
// globalThis Map, so limits are actually shared across concurrent
// serverless instances rather than reset per cold start.
export async function checkRateLimit({
  key,
  limit,
  windowMs
}: RateLimitOptions): Promise<RateLimitResult> {

  try {

    const supabase = createServiceClient()

    const { data, error } =
      await supabase
        .rpc("check_rate_limit", {
          p_key: key,
          p_limit: limit,
          p_window_ms: windowMs
        })
        .single()

    if (error || !data) {
      throw error || new Error("No rate limit row returned.")
    }

    const row =
      data as {
        allowed: boolean
        remaining: number
        reset_at: string
        retry_after_seconds: number
      }

    return {
      allowed: row.allowed,
      remaining: row.remaining,
      resetAt: new Date(row.reset_at).getTime(),
      retryAfterSeconds: row.retry_after_seconds
    }

  } catch (error) {

    // Rate limiting here is defense-in-depth, not the actual security
    // boundary (RLS/auth are) -- a transient DB error should not turn
    // into a full outage, so this fails open rather than closed.
    console.error(
      "Rate limit check failed, allowing request:",
      error
    )

    return {
      allowed: true,
      remaining: limit,
      resetAt: Date.now() + windowMs,
      retryAfterSeconds: 0
    }

  }

}
