import {
  CrawlFailureReason,
  crawlWebsite
} from "./crawler"
import { validateWebsiteUrl } from "./urlValidation"
import { createServiceClient } from "@/lib/supabase/service"

export type QueuedAuditResult =
  | {
      success: true
      status: "completed"
      data: Awaited<
        ReturnType<typeof crawlWebsite>
      >
      queue: AuditQueueSnapshot
    }
  | {
      success: false
      status:
        | "invalid"
        | "locked"
        | "queue_full"
        | "failed"
      error: string
      failureReason: CrawlFailureReason
      durationMs: number
      queue: AuditQueueSnapshot
    }

export type AuditQueueSnapshot = {
  active: number
  running: number
  queued: number
  failed: number
  failedByReason:
    Partial<Record<CrawlFailureReason, number>>
  maxActive: number
  maxQueued: number
  activeUrls: string[]
}

function getPositiveIntegerEnv(
  key: string,
  fallback: number
) {
  const parsed =
    Number(process.env[key])

  if (
    Number.isInteger(parsed) &&
    parsed > 0
  ) {
    return parsed
  }

  return fallback
}

export function getAuditQueueConfig() {
  return {
    maxActive:
      getPositiveIntegerEnv(
        "CRAWL_QUEUE_CONCURRENCY",
        2
      ),
    maxQueued:
      getPositiveIntegerEnv(
        "CRAWL_QUEUE_MAX_SIZE",
        12
      ),
    staleAfterMs:
      getPositiveIntegerEnv(
        "CRAWL_QUEUE_STALE_MS",
        360_000
      )
  }
}

// Backed by the audit_queue_jobs / audit_queue_failure_counts tables
// (see the durable-audit-queue migration) instead of a globalThis
// object, so the active-slot count, per-URL locks, and failure counters
// are shared across concurrent serverless instances rather than reset
// per cold start. There is no "queued" state anymore -- a row's
// existence IS "currently running"; a request either claims a free slot
// immediately or is rejected, it never waits.
export async function getAuditQueueSnapshot():
  Promise<AuditQueueSnapshot> {

  const config = getAuditQueueConfig()
  const supabase = createServiceClient()

  const [jobsResult, failuresResult] =
    await Promise.all([
      supabase
        .from("audit_queue_jobs")
        .select("lock_key"),
      supabase
        .from("audit_queue_failure_counts")
        .select("failure_reason, count")
    ])

  const activeUrls =
    (jobsResult.data || []).map(
      (row) => row.lock_key as string
    )

  const failedByReason =
    Object.fromEntries(
      (failuresResult.data || []).map(
        (row) => [
          row.failure_reason as CrawlFailureReason,
          Number(row.count)
        ]
      )
    ) as Partial<
      Record<CrawlFailureReason, number>
    >

  const failed =
    Object.values(failedByReason).reduce(
      (sum, count) => sum + (count || 0),
      0
    )

  return {
    active: activeUrls.length,
    running: activeUrls.length,
    queued: 0,
    failed,
    failedByReason,
    maxActive: config.maxActive,
    maxQueued: config.maxQueued,
    activeUrls
  }

}

export async function enqueueAudit(
  url: string,
  orgId: string | null,
  options?: {
    lockKey?: string
    maxPages?: number
  }
): Promise<QueuedAuditResult> {

  const urlValidation =
    validateWebsiteUrl(url)

  if (!urlValidation.success) {
    return {
      success: false,
      status: "invalid",
      error: urlValidation.error,
      failureReason: "invalid_url",
      durationMs: 0,
      queue:
        await getAuditQueueSnapshot()
    }
  }

  const normalizedUrl =
    urlValidation.url

  // Locking is per (org, url) — two different organizations auditing
  // the same public URL at the same time isn't a race condition once
  // audits are org-scoped, only two crawls of the same URL within the
  // same org are. Anonymous (org-less) callers pass an explicit
  // IP-scoped lockKey instead, so one visitor can't run concurrent
  // teaser crawls of the same URL.
  const lockKey =
    options?.lockKey ??
    `${orgId}:${normalizedUrl}`

  const config = getAuditQueueConfig()
  const supabase = createServiceClient()

  let startResult: {
    claimed: boolean
    reason: string
  }

  try {

    const { data, error } =
      await supabase
        .rpc("try_start_audit", {
          p_lock_key: lockKey,
          p_max_active: config.maxActive,
          p_stale_after_ms:
            config.staleAfterMs
        })
        .single()

    if (error || !data) {
      throw (
        error ||
        new Error(
          "No slot-claim row returned."
        )
      )
    }

    startResult =
      data as {
        claimed: boolean
        reason: string
      }

  } catch (error) {

    console.error(
      "Failed to claim an audit queue slot:",
      error
    )

    // Fails closed (unlike the rate limiter) — a DB hiccup here should
    // reject the request, not silently disable the dedup/concurrency
    // guard and risk unbounded concurrent crawls.
    return {
      success: false,
      status: "failed",
      error:
        "Unable to start the audit right now. Please try again shortly.",
      failureReason: "unknown",
      durationMs: 0,
      queue:
        await getAuditQueueSnapshot()
    }

  }

  if (!startResult.claimed) {

    if (startResult.reason === "locked") {
      return {
        success: false,
        status: "locked",
        error:
          "An audit is already running for this URL. Please wait for it to finish.",
        failureReason: "queue_rejection",
        durationMs: 0,
        queue:
          await getAuditQueueSnapshot()
      }
    }

    return {
      success: false,
      status: "queue_full",
      error:
        "The audit queue is currently full. Please try again shortly.",
      failureReason: "queue_rejection",
      durationMs: 0,
      queue:
        await getAuditQueueSnapshot()
    }

  }

  const startedAt = Date.now()

  try {

    const result =
      await crawlWebsite(
        normalizedUrl,
        orgId,
        options?.maxPages
          ? { maxPages: options.maxPages }
          : undefined
      )

    if (!result.success) {

      await supabase.rpc("finish_audit", {
        p_lock_key: lockKey,
        p_failure_reason:
          result.failureReason ||
          "unknown"
      })

      return {
        success: false,
        status: "failed",
        error:
          result.error ||
          "Audit failed.",
        failureReason:
          result.failureReason ||
          "unknown",
        durationMs:
          result.durationMs,
        queue:
          await getAuditQueueSnapshot()
      }

    }

    await supabase.rpc("finish_audit", {
      p_lock_key: lockKey,
      p_failure_reason: null
    })

    return {
      success: true,
      status: "completed",
      data: result,
      queue:
        await getAuditQueueSnapshot()
    }

  } catch (error) {

    console.error(error)

    await supabase
      .rpc("finish_audit", {
        p_lock_key: lockKey,
        p_failure_reason: "unknown"
      })
      .then(
        () => {},
        (releaseError) => {
          console.error(
            "Failed to release audit queue slot:",
            releaseError
          )
        }
      )

    return {
      success: false,
      status: "failed",
      error:
        error instanceof Error
          ? error.message
          : "Audit failed.",
      failureReason: "unknown",
      durationMs:
        Date.now() - startedAt,
      queue:
        await getAuditQueueSnapshot()
    }

  }

}
