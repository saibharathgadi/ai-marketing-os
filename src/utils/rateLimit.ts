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

type RateLimitEntry = {
  count: number
  resetAt: number
}

const storeKey =
  "__aiMarketingOsRateLimits"

const globalForRateLimits =
  globalThis as typeof globalThis & {
    [storeKey]?: Map<string, RateLimitEntry>
  }

const rateLimitStore =
  globalForRateLimits[storeKey] ||
  new Map<string, RateLimitEntry>()

globalForRateLimits[storeKey] =
  rateLimitStore

function pruneExpiredEntries(now: number) {
  if (rateLimitStore.size < 500) {
    return
  }

  for (const [key, entry] of rateLimitStore) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key)
    }
  }
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

export function checkRateLimit({
  key,
  limit,
  windowMs
}: RateLimitOptions): RateLimitResult {
  const now = Date.now()

  pruneExpiredEntries(now)

  const existing =
    rateLimitStore.get(key)

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs

    rateLimitStore.set(key, {
      count: 1,
      resetAt
    })

    return {
      allowed: true,
      remaining: Math.max(limit - 1, 0),
      resetAt,
      retryAfterSeconds: 0
    }
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSeconds:
        Math.ceil(
          (existing.resetAt - now) / 1000
        )
    }
  }

  existing.count += 1

  return {
    allowed: true,
    remaining:
      Math.max(limit - existing.count, 0),
    resetAt: existing.resetAt,
    retryAfterSeconds: 0
  }
}
