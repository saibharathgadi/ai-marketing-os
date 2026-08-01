import { analyzePage } from "./analyzer"
import { analyzeTechnicalSeo } from "./technicalSeo"
import { analyzeAnswerEngineSeo } from "./answerEngineSeo"
import { createServiceClient } from "@/lib/supabase/service"
import { generateAIRecommendations } from "./aiRecommendations"
import {
  fetchWithSsrfProtection,
  validateWebsiteUrl
} from "./urlValidation"
import { isMissingColumnError } from "./schemaCompat"
import { generateSiteSummary } from "./summary"

type TechnicalSeoResult = Awaited<
  ReturnType<typeof analyzeTechnicalSeo>
> &
  Awaited<ReturnType<typeof analyzeAnswerEngineSeo>>

type PageSnapshot = {
  finalUrl: string
  html: string
  title: string
  metaDescription: string | null
  h1s: string[]
  h2s: string[]
  h3s: string[]
  text: string
  links: string[]
}

export type CrawlFailureReason =
  | "timeout"
  | "blocked"
  | "non-html"
  | "queue_rejection"
  | "invalid_url"
  | "unknown"

type LoadPageResult =
  | {
      success: true
      page: PageSnapshot
    }
  | {
      success: false
      reason: CrawlFailureReason
    }

type CrawledPage = ReturnType<typeof analyzePage> & {
  url: string
  aiRecommendations: string
}

type AuditInsertPayload = {
  url: string
  org_id: string
  average_score: number
  total_pages: number
  total_issues: number
  technical_seo?: TechnicalSeoResult
  crawl_duration_ms?: number
  crawl_status?: "completed" | "failed"
  crawl_failure_reason?: CrawlFailureReason | null
  is_slow?: boolean
}

type AuditInsertResult = {
  id: string
}

// Defaults aim for a genuinely complete audit of a typical small-to-mid
// business site (not just the homepage + a handful of links) while
// staying inside serverless function time limits (see maxDuration on the
// routes that call crawlWebsite). timeBudgetMs is the hard safety net:
// once elapsed, the crawl stops enqueueing new pages and persists
// whatever was gathered, so a very large site degrades to "as complete
// as we had time for" instead of failing outright.
const defaultMaxPages = 60
const defaultPageConcurrency = 5
const defaultTimeBudgetMs = 45_000
const maxHtmlBytes = 3_000_000
const defaultSlowCrawlMs = 10_000
const maxSitemapUrls = 500
const maxNestedSitemaps = 5

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

function getCrawlConfig() {
  return {
    maxPages:
      getPositiveIntegerEnv(
        "CRAWL_MAX_PAGES",
        defaultMaxPages
      ),
    pageConcurrency:
      getPositiveIntegerEnv(
        "CRAWL_PAGE_CONCURRENCY",
        defaultPageConcurrency
      ),
    timeBudgetMs:
      getPositiveIntegerEnv(
        "CRAWL_TIME_BUDGET_MS",
        defaultTimeBudgetMs
      ),
    slowCrawlMs:
      getPositiveIntegerEnv(
        "CRAWL_SLOW_MS",
        defaultSlowCrawlMs
      )
  }
}

export function extractInternalLinks(
  links: string[],
  baseUrl: string
) {

  const base = new URL(baseUrl)
  const normalizedBase =
    normalizeUrlForComparison(base.href)

  const internalLinks: string[] = []
  const seen = new Set<string>()

  for (const link of links) {

    try {

      const candidate = new URL(link)
      const normalizedCandidate =
        normalizeUrlForComparison(
          candidate.href
        )

      if (
        candidate.hostname === base.hostname &&
        normalizedCandidate !== normalizedBase &&
        !seen.has(normalizedCandidate)
      ) {
        seen.add(normalizedCandidate)
        internalLinks.push(normalizedCandidate)
      }

    } catch {

      continue

    }

  }

  return internalLinks

}

async function fetchTextWithTimeout(
  url: string,
  timeoutMs: number
) {
  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    timeoutMs
  )

  try {
    const response = await fetchWithSsrfProtection(url, {
      signal: controller.signal
    })

    if (!response.ok) {
      return null
    }

    return await response.text()
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Discovers the full set of known page URLs from sitemap.xml (following
 * one level of sitemap-index nesting, capped) so a full audit isn't
 * limited to whatever happens to be linked from the homepage. Best
 * effort: sites without a sitemap simply fall back to pure link-crawling.
 */
async function discoverSitemapUrls(
  baseUrl: string,
  hostname: string
): Promise<string[]> {
  const origin = new URL(baseUrl).origin
  const locPattern = /<loc>\s*([^<\s]+)\s*<\/loc>/gi

  const rootXml = await fetchTextWithTimeout(
    `${origin}/sitemap.xml`,
    8000
  )

  if (!rootXml) {
    return []
  }

  const rootLocs = [...rootXml.matchAll(locPattern)].map(
    (match) => match[1]
  )

  const isSitemapIndex = /<sitemapindex\b/i.test(rootXml)

  const pageUrls = new Set<string>()

  if (!isSitemapIndex) {
    for (const loc of rootLocs) {
      pageUrls.add(loc)

      if (pageUrls.size >= maxSitemapUrls) {
        break
      }
    }

    return [...pageUrls]
  }

  // Sitemap index: fetch a bounded number of child sitemaps and collect
  // their <loc> entries instead (those are the actual page URLs).
  const childSitemaps = rootLocs.slice(0, maxNestedSitemaps)

  for (const childUrl of childSitemaps) {
    let childHost: string

    try {
      childHost = new URL(childUrl).hostname
    } catch {
      continue
    }

    if (childHost !== hostname) {
      continue
    }

    const childXml = await fetchTextWithTimeout(
      childUrl,
      8000
    )

    if (!childXml) {
      continue
    }

    for (const match of childXml.matchAll(locPattern)) {
      pageUrls.add(match[1])

      if (pageUrls.size >= maxSitemapUrls) {
        return [...pageUrls]
      }
    }
  }

  return [...pageUrls]
}

function normalizeUrlForComparison(url: string) {

  const parsed = new URL(url)

  parsed.hash = ""
  parsed.search = ""

  if (
    parsed.pathname !== "/" &&
    parsed.pathname.endsWith("/")
  ) {
    parsed.pathname = parsed.pathname.slice(0, -1)
  }

  return parsed.href

}

async function readHtmlWithLimit(
  response: Response,
  maxBytes: number
) {
  if (!response.body) {
    const text = await response.text()

    return text.length > maxBytes
      ? null
      : text
  }

  const reader =
    response.body.getReader()
  const decoder =
    new TextDecoder()
  let receivedBytes = 0
  let html = ""

  while (true) {
    const { done, value } =
      await reader.read()

    if (done) {
      break
    }

    receivedBytes += value.byteLength

    if (receivedBytes > maxBytes) {
      await reader.cancel()
      return null
    }

    html += decoder.decode(value, {
      stream: true
    })
  }

  html += decoder.decode()

  return html
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  callback: (item: T) => Promise<R>
) {
  const results: R[] = []
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1

      results[currentIndex] =
        await callback(items[currentIndex])
    }
  }

  await Promise.all(
    Array.from({
      length:
        Math.min(
          concurrency,
          items.length
        )
    }).map(() => worker())
  )

  return results
}

function decodeHtml(value: string) {

  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")

}

function stripTags(value: string) {

  return decodeHtml(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  )

}

function extractFirst(
  html: string,
  pattern: RegExp
) {

  const match = html.match(pattern)

  return match?.[1]
    ? decodeHtml(match[1].trim())
    : null

}

function extractHeadings(
  html: string,
  tagName: "h1" | "h2" | "h3"
) {

  const pattern = new RegExp(
    `<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`,
    "gi"
  )

  return [...html.matchAll(pattern)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)

}

function extractLinks(
  html: string,
  baseUrl: string
) {

  return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)]
    .map((match) => match[1])
    .filter(
      (href) =>
        !href.startsWith("#") &&
        !href.startsWith("mailto:") &&
        !href.startsWith("tel:") &&
        !href.startsWith("javascript:")
    )
    .map((href) => {
      try {
        return new URL(href, baseUrl).href
      } catch {
        return null
      }
    })
    .filter((href): href is string => Boolean(href))

}

async function loadPage(
  url: string
): Promise<LoadPageResult> {

  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    15000
  )

  try {

    const response = await fetchWithSsrfProtection(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36"
      }
    })

    if (!response.ok) {
      return {
        success: false,
        reason: "blocked"
      }
    }

    const contentType =
      response.headers.get("content-type") || ""

    if (
      contentType &&
      !contentType.toLowerCase().includes("text/html")
    ) {
      return {
        success: false,
        reason: "non-html"
      }
    }

    const contentLength =
      Number(
        response.headers.get("content-length")
      )

    if (
      Number.isFinite(contentLength) &&
      contentLength > maxHtmlBytes
    ) {
      return {
        success: false,
        reason: "non-html"
      }
    }

    const html =
      await readHtmlWithLimit(
        response,
        maxHtmlBytes
      )

    if (!html) {
      return {
        success: false,
        reason: "non-html"
      }
    }

    const finalUrl = response.url || url

    return {
      success: true,
      page: {
        finalUrl,
        html,
        title:
          extractFirst(
            html,
            /<title\b[^>]*>([\s\S]*?)<\/title>/i
          ) || "",
        metaDescription:
          extractFirst(
            html,
            /<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i
          ) ||
          extractFirst(
            html,
            /<meta\b[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i
          ),
        h1s: extractHeadings(html, "h1"),
        h2s: extractHeadings(html, "h2"),
        h3s: extractHeadings(html, "h3"),
        text: stripTags(html),
        links: extractLinks(html, finalUrl)
      }
    }

  } catch (error) {

    return {
      success: false,
      reason:
        error instanceof DOMException &&
        error.name === "AbortError"
          ? "timeout"
          : "unknown"
    }

  } finally {

    clearTimeout(timeout)

  }

}

async function createAuditRecord(
  payload: AuditInsertPayload
) {

  const supabase = createServiceClient()

  const withTechnicalSeo =
    await supabase
      .from("audits")
      .insert(payload)
      .select("id")
      .single()

  if (!withTechnicalSeo.error) {
    return withTechnicalSeo.data as AuditInsertResult
  }

  const missingTechnicalSeoColumn =
    isMissingColumnError(
      withTechnicalSeo.error.message,
      [
        "technical_seo",
        "crawl_duration_ms",
        "crawl_status",
        "crawl_failure_reason",
        "is_slow"
      ]
    )

  if (!missingTechnicalSeoColumn) {
    throw new Error(
      `Failed to create audit: ${withTechnicalSeo.error.message}`
    )
  }

  console.warn(
    "One or more optional audit diagnostic columns are missing; continuing with the base audit schema."
  )

  const fallbackPayload = {
    url: payload.url,
    org_id: payload.org_id,
    average_score:
      payload.average_score,
    total_pages:
      payload.total_pages,
    total_issues:
      payload.total_issues
  }

  const withoutTechnicalSeo =
    await supabase
      .from("audits")
      .insert(fallbackPayload)
      .select("id")
      .single()

  if (withoutTechnicalSeo.error) {
    throw new Error(
      `Failed to create audit: ${withoutTechnicalSeo.error.message}`
    )
  }

  return withoutTechnicalSeo.data as AuditInsertResult

}

async function persistCrawledPages(
  auditId: string,
  crawledPages: CrawledPage[]
) {

  const supabase = createServiceClient()

  const pagesToInsert =
    crawledPages.map((page) => ({

      audit_id: auditId,

      url: page.url,

      title: page.title,

      meta_description:
        page.metaDescription,

      h1s: page.h1s,

      h2s: page.h2s,

      seo_score: page.seoScore,

      word_count: page.wordCount,

      issues: page.seoIssues,

      ai_recommendations:
        page.aiRecommendations

    }))

  const { error } =
    await supabase
      .from("crawled_pages")
      .insert(pagesToInsert)

  if (error) {
    throw new Error(
      `Failed to persist crawled pages: ${error.message}`
    )
  }

}

export async function crawlWebsite(
  url: string,
  orgId: string
) {

  const startedAt = Date.now()
  const urlValidation =
    validateWebsiteUrl(url)
  const getDurationMs = () =>
    Date.now() - startedAt

  if (!urlValidation.success) {
    return {
      success: false,
      error: urlValidation.error,
      failureReason:
        "invalid_url" as CrawlFailureReason,
      durationMs: getDurationMs(),
      isSlow: false
    }
  }

  const crawlConfig =
    getCrawlConfig()

  const homepageResult =
    await loadPage(urlValidation.url)

  if (!homepageResult.success) {

    console.error(
      "Homepage failed completely:",
      url
    )

    const durationMs =
      getDurationMs()

    return {
      success: false,
      failureReason:
        homepageResult.reason,
      durationMs,
      isSlow:
        durationMs >= crawlConfig.slowCrawlMs,
      error:
        homepageResult.reason === "timeout"
          ? "The website took too long to respond."
          : homepageResult.reason === "non-html"
            ? "The URL did not return an HTML page."
            : homepageResult.reason === "blocked"
              ? "The website blocked the crawl request."
              : "Unable to access website. The website may be blocking crawlers or responding too slowly."
    }

  }

  const homepage =
    homepageResult.page

  const homepageAnalysis =
    analyzePage({
      title: homepage.title,
      metaDescription:
        homepage.metaDescription,
      h1s: homepage.h1s,
      h2s: homepage.h2s,
      h3s: homepage.h3s,
      text: homepage.text,
      totalLinks:
        homepage.links.length
    })

  const homepageRecommendations =
    await generateAIRecommendations(
      homepageAnalysis
    )

  const [technicalSeoResult, answerEngineSeoResult] =
    await Promise.all([
      analyzeTechnicalSeo(
        homepage.html,
        homepage.finalUrl
      ),
      analyzeAnswerEngineSeo({
        html: homepage.html,
        text: homepage.text,
        baseUrl: homepage.finalUrl,
        h1s: homepage.h1s,
        h2s: homepage.h2s,
        h3s: homepage.h3s
      })
    ])

  const technicalSeo: TechnicalSeoResult = {
    ...technicalSeoResult,
    ...answerEngineSeoResult
  }

  const crawledPages: CrawledPage[] = [
    {
      url: homepage.finalUrl,
      ...homepageAnalysis,
      aiRecommendations:
        homepageRecommendations
    }
  ]

  const homepageHostname =
    new URL(homepage.finalUrl).hostname

  const visited = new Set<string>([
    normalizeUrlForComparison(homepage.finalUrl)
  ])

  const sitemapUrls =
    await discoverSitemapUrls(
      homepage.finalUrl,
      homepageHostname
    )

  const homepageLinks =
    extractInternalLinks(
      homepage.links,
      homepage.finalUrl
    )

  const internalLinks = homepageLinks

  const queue: string[] = []

  function enqueue(rawUrl: string) {
    let normalized: string

    try {
      const candidate = new URL(rawUrl)

      if (candidate.hostname !== homepageHostname) {
        return
      }

      normalized = normalizeUrlForComparison(
        candidate.href
      )
    } catch {
      return
    }

    if (visited.has(normalized)) {
      return
    }

    visited.add(normalized)
    queue.push(normalized)
  }

  for (const link of [...sitemapUrls, ...homepageLinks]) {
    enqueue(link)
  }

  const deadlineAt =
    startedAt + crawlConfig.timeBudgetMs

  while (
    queue.length > 0 &&
    crawledPages.length < crawlConfig.maxPages &&
    Date.now() < deadlineAt
  ) {

    const remainingPageBudget =
      crawlConfig.maxPages - crawledPages.length

    const batch =
      queue.splice(
        0,
        Math.min(
          crawlConfig.pageConcurrency,
          remainingPageBudget
        )
      )

    const batchResults =
      await mapWithConcurrency(
        batch,
        crawlConfig.pageConcurrency,
        async (link) => {

          try {

            console.log(
              "Crawling:",
              link
            )

            const subPage =
              await loadPage(link)

            if (!subPage.success) {

              console.log(
                "Skipping page:",
                link,
                subPage.reason
              )

              return null

            }

            const analysis =
              analyzePage({
                title: subPage.page.title,
                metaDescription:
                  subPage.page.metaDescription,
                h1s: subPage.page.h1s,
                h2s: subPage.page.h2s,
                h3s: subPage.page.h3s,
                text: subPage.page.text,
                totalLinks:
                  subPage.page.links.length
              })

            const aiRecommendations =
              await generateAIRecommendations(
                analysis
              )

            return {
              crawledPage: {
                url: subPage.page.finalUrl || link,
                ...analysis,
                aiRecommendations
              } as CrawledPage,
              discoveredLinks:
                extractInternalLinks(
                  subPage.page.links,
                  subPage.page.finalUrl
                )
            }

          } catch (error) {

            console.error(
              "Error crawling page:",
              link,
              error
            )

            return null

          }

        }
      )

    for (const result of batchResults) {

      if (!result) {
        continue
      }

      crawledPages.push(result.crawledPage)

      if (Date.now() >= deadlineAt) {
        continue
      }

      for (const discoveredLink of result.discoveredLinks) {
        enqueue(discoveredLink)
      }

    }

  }

  const siteSummary =
    generateSiteSummary(crawledPages)

  const { averageSeoScore, totalIssues } =
    siteSummary

  let auditId: string | null = null

  try {
    const durationMs =
      getDurationMs()
    const isSlow =
      durationMs >= crawlConfig.slowCrawlMs

    const auditData =
      await createAuditRecord({
        url: urlValidation.url,
        org_id: orgId,
        average_score:
          averageSeoScore,
        total_pages:
          crawledPages.length,
        total_issues:
          totalIssues,
        technical_seo:
          technicalSeo,
        crawl_duration_ms:
          durationMs,
        crawl_status:
          "completed",
        crawl_failure_reason:
          null,
        is_slow:
          isSlow
      })

    auditId = auditData.id

    await persistCrawledPages(
      auditData.id,
      crawledPages
    )

  } catch (error) {

    console.error(error)

    const durationMs =
      getDurationMs()

    return {
      success: false,
      failureReason:
        "unknown" as CrawlFailureReason,
      durationMs,
      isSlow:
        durationMs >= crawlConfig.slowCrawlMs,
      error:
        error instanceof Error
          ? error.message
          : "Failed to save audit data."
    }

  }

  return {

    success: true,
    auditId,
    durationMs:
      getDurationMs(),
    isSlow:
      getDurationMs() >= crawlConfig.slowCrawlMs,
    failureReason:
      null,

    homepageAnalysis,

    technicalSeo,

    internalLinks,

    crawledPages,

    siteSummary

  }

}
