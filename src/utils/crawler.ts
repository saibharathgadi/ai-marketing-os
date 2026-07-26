import { analyzePage } from "./analyzer"
import { analyzeTechnicalSeo } from "./technicalSeo"
import { supabase } from "@/lib/supabase"
import { generateAIRecommendations } from "./aiRecommendations"
import {
  fetchWithSsrfProtection,
  validateWebsiteUrl
} from "./urlValidation"

type TechnicalSeoResult = Awaited<
  ReturnType<typeof analyzeTechnicalSeo>
>

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

const defaultMaxPages = 6
const defaultPageConcurrency = 2
const maxHtmlBytes = 3_000_000
const defaultSlowCrawlMs = 10_000

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
  const maxPages =
    getPositiveIntegerEnv(
      "CRAWL_MAX_PAGES",
      defaultMaxPages
    )

  return {
    maxPages,
    maxInternalLinks:
      Math.max(maxPages - 1, 0),
    pageConcurrency:
      getPositiveIntegerEnv(
        "CRAWL_PAGE_CONCURRENCY",
        defaultPageConcurrency
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

  return internalLinks.slice(
    0,
    getCrawlConfig().maxInternalLinks
  )

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

  const withTechnicalSeo =
    await supabase
      .from("audits")
      .insert(payload)
      .select("id")
      .single()

  if (!withTechnicalSeo.error) {
    return withTechnicalSeo.data as AuditInsertResult
  }

  const message =
    withTechnicalSeo.error.message.toLowerCase()

  const missingTechnicalSeoColumn =
    message.includes("technical_seo") ||
    message.includes("crawl_duration_ms") ||
    message.includes("crawl_status") ||
    message.includes("crawl_failure_reason") ||
    message.includes("is_slow") ||
    message.includes("schema cache")

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

export async function crawlWebsite(url: string) {

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

  const technicalSeo =
    await analyzeTechnicalSeo(
      homepage.html,
      homepage.finalUrl
    )

  const crawledPages: CrawledPage[] = [
    {
      url: homepage.finalUrl,
      ...homepageAnalysis,
      aiRecommendations:
        homepageRecommendations
    }
  ]

  const internalLinks =
    extractInternalLinks(
      homepage.links,
      homepage.finalUrl
    )

  const crawlableLinks =
    internalLinks.slice(
      0,
      Math.max(crawlConfig.maxPages - 1, 0)
    )

  const subPages =
    await mapWithConcurrency(
      crawlableLinks,
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
              "Skipping slow page:",
              link
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
            url: subPage.page.finalUrl || link,
            ...analysis,
            aiRecommendations
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

  crawledPages.push(
    ...subPages.filter(
      (page): page is CrawledPage =>
        Boolean(page)
    )
  )

  const averageSeoScore =
    Math.round(
      crawledPages.reduce(
        (acc, page) =>
          acc + page.seoScore,
        0
      ) / crawledPages.length
    )

  const totalIssues =
    crawledPages.reduce(
      (acc, page) =>
        acc + page.seoIssues.length,
      0
    )

  const bestPage =
    crawledPages.reduce(
      (best, current) =>
        current.seoScore >
        best.seoScore
          ? current
          : best
    )

  const worstPage =
    crawledPages.reduce(
      (worst, current) =>
        current.seoScore <
        worst.seoScore
          ? current
          : worst
    )

  const siteSummary = {

    totalPages:
      crawledPages.length,

    averageSeoScore,

    totalIssues,

    bestPage,

    worstPage

  }

  let auditId: string | null = null

  try {
    const durationMs =
      getDurationMs()
    const isSlow =
      durationMs >= crawlConfig.slowCrawlMs

    const auditData =
      await createAuditRecord({
        url: urlValidation.url,
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
