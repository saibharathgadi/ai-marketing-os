import { crawlWebsite } from "./crawler"
import { validateWebsiteUrl } from "./urlValidation"

type AuditQueueJob = {
  id: string
  url: string
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
      queue: AuditQueueSnapshot
    }

export type AuditQueueSnapshot = {
  active: number
  running: number
  queued: number
  failed: number
  maxActive: number
  maxQueued: number
  activeUrls: string[]
}

type AuditQueueState = {
  activeCount: number
  failedCount: number
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
    queue: [],
    activeUrls: new Set<string>()
  }

globalForAuditQueue[stateKey] = state

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
  }

  state.activeCount =
    Math.max(state.activeCount - 1, 0)
  state.activeUrls.delete(job.url)
  job.resolve(result)
  processQueue()
}

async function runJob(job: AuditQueueJob) {
  job.startedAt = Date.now()

  try {
    const result =
      await crawlWebsite(job.url)

    if (!result.success) {
      completeJob(job, {
        success: false,
        status: "failed",
        error:
          result.error ||
          "Audit failed.",
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
  url: string
): Promise<QueuedAuditResult> {
  const urlValidation =
    validateWebsiteUrl(url)

  if (!urlValidation.success) {
    return {
      success: false,
      status: "invalid",
      error: urlValidation.error,
      queue:
        getAuditQueueSnapshot()
    }
  }

  const normalizedUrl =
    urlValidation.url

  if (state.activeUrls.has(normalizedUrl)) {
    return {
      success: false,
      status: "locked",
      error:
        "An audit is already running for this URL. Please wait for it to finish.",
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
      queue:
        getAuditQueueSnapshot()
    }
  }

  state.activeUrls.add(normalizedUrl)

  return new Promise((resolve) => {
    state.queue.push({
      id:
        `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`,
      url: normalizedUrl,
      enqueuedAt: Date.now(),
      resolve
    })

    processQueue()
  })
}
