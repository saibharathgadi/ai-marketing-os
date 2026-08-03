import {
  CrawlFailureReason,
  crawlWebsite
} from "./crawler"
import { validateWebsiteUrl } from "./urlValidation"

type AuditQueueJob = {
  id: string
  url: string
  orgId: string | null
  maxPages?: number
  lockKey: string
  enqueuedAt: number
  startedAt?: number
  resolve: (
    result: QueuedAuditResult
  ) => void
}

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

type AuditQueueState = {
  activeCount: number
  failedCount: number
  failedByReason:
    Partial<Record<CrawlFailureReason, number>>
  queue: AuditQueueJob[]
  activeUrls: Set<string>
}

const stateKey =
  "__aiMarketingOsAuditQueue"

const globalForAuditQueue =
  globalThis as typeof globalThis & {
    [stateKey]?: AuditQueueState
  }

const state =
  globalForAuditQueue[stateKey] || {
    activeCount: 0,
    failedCount: 0,
    failedByReason: {},
    queue: [],
    activeUrls: new Set<string>()
  }

globalForAuditQueue[stateKey] = state

state.failedByReason =
  state.failedByReason || {}

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
      )
  }
}

export function getAuditQueueSnapshot():
  AuditQueueSnapshot {
  const config =
    getAuditQueueConfig()

  return {
    active: state.activeCount,
    running: state.activeCount,
    queued: state.queue.length,
    failed: state.failedCount,
    failedByReason:
      state.failedByReason,
    maxActive: config.maxActive,
    maxQueued: config.maxQueued,
    activeUrls:
      Array.from(state.activeUrls)
  }
}

function completeJob(
  job: AuditQueueJob,
  result: QueuedAuditResult
) {
  if (!result.success) {
    state.failedCount += 1
    state.failedByReason[
      result.failureReason
    ] =
      (state.failedByReason[
        result.failureReason
      ] || 0) + 1
  }

  state.activeCount =
    Math.max(state.activeCount - 1, 0)
  state.activeUrls.delete(job.lockKey)
  job.resolve(result)
  processQueue()
}

async function runJob(job: AuditQueueJob) {
  job.startedAt = Date.now()

  try {
    const result =
      await crawlWebsite(
        job.url,
        job.orgId,
        job.maxPages
          ? { maxPages: job.maxPages }
          : undefined
      )

    if (!result.success) {
      completeJob(job, {
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
          getAuditQueueSnapshot()
      })

      return
    }

    completeJob(job, {
      success: true,
      status: "completed",
      data: result,
      queue:
        getAuditQueueSnapshot()
    })
  } catch (error) {
    console.error(error)

    completeJob(job, {
      success: false,
      status: "failed",
      error:
        error instanceof Error
          ? error.message
          : "Audit failed.",
      failureReason: "unknown",
      durationMs:
        Date.now() -
        (job.startedAt || Date.now()),
      queue:
        getAuditQueueSnapshot()
    })
  }
}

function processQueue() {
  const { maxActive } =
    getAuditQueueConfig()

  while (
    state.activeCount < maxActive &&
    state.queue.length > 0
  ) {
    const nextJob =
      state.queue.shift()

    if (!nextJob) {
      return
    }

    state.activeCount += 1
    void runJob(nextJob)
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
        getAuditQueueSnapshot()
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

  if (state.activeUrls.has(lockKey)) {
    return {
      success: false,
      status: "locked",
      error:
        "An audit is already running for this URL. Please wait for it to finish.",
      failureReason: "queue_rejection",
      durationMs: 0,
      queue:
        getAuditQueueSnapshot()
    }
  }

  const { maxQueued } =
    getAuditQueueConfig()

  if (state.queue.length >= maxQueued) {
    return {
      success: false,
      status: "queue_full",
      error:
        "The audit queue is currently full. Please try again shortly.",
      failureReason: "queue_rejection",
      durationMs: 0,
      queue:
        getAuditQueueSnapshot()
    }
  }

  state.activeUrls.add(lockKey)

  return new Promise((resolve) => {
    state.queue.push({
      id:
        `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`,
      url: normalizedUrl,
      orgId,
      maxPages: options?.maxPages,
      lockKey,
      enqueuedAt: Date.now(),
      resolve
    })

    processQueue()
  })
}
