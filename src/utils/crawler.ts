import { analyzePage } from "./analyzer"
import { analyzeTechnicalSeo } from "./technicalSeo"
import { supabase } from "@/lib/supabase"
import { generateAIRecommendations } from "./aiRecommendations"

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
}

type AuditInsertResult = {
  id: string
}

export function extractInternalLinks(
  links: string[],
  baseUrl: string
) {

  const base = new URL(baseUrl)
  const normalizedBase =
    normalizeUrlForComparison(base.href)

  const internalLinks = links.filter((link) => {

    try {

      const candidate = new URL(link)

      return (
        candidate.hostname === base.hostname &&
        normalizeUrlForComparison(candidate.href) !==
          normalizedBase
      )

    } catch {

      return false

    }

  })

  return [...new Set(internalLinks)].slice(0, 5)

}

function normalizeUrlForComparison(url: string) {

  const parsed = new URL(url)

  parsed.hash = ""

  if (
    parsed.pathname !== "/" &&
    parsed.pathname.endsWith("/")
  ) {
    parsed.pathname = parsed.pathname.slice(0, -1)
  }

  return parsed.href

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
): Promise<PageSnapshot | null> {

  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    15000
  )

  try {

    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36"
      }
    })

    if (!response.ok) {
      return null
    }

    const html = await response.text()
    const finalUrl = response.url || url

    return {
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

  } catch {

    return null

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
    message.includes("schema cache")

  if (!missingTechnicalSeoColumn) {
    throw new Error(
      `Failed to create audit: ${withTechnicalSeo.error.message}`
    )
  }

  console.warn(
    "technical_seo column is missing on audits; continuing without persisted technical SEO."
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

  const homepage =
    await loadPage(url)

  if (!homepage) {

    console.error(
      "Homepage failed completely:",
      url
    )

    return {
      success: false,
      error:
        "Unable to access website. The website may be blocking crawlers or responding too slowly."
    }

  }

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

  for (const link of internalLinks) {

    try {

      console.log(
        "Crawling:",
        link
      )

      const subPage =
        await loadPage(link)

      if (!subPage) {

        console.log(
          "Skipping slow page:",
          link
        )

        continue

      }

      const analysis =
        analyzePage({
          title: subPage.title,
          metaDescription:
            subPage.metaDescription,
          h1s: subPage.h1s,
          h2s: subPage.h2s,
          h3s: subPage.h3s,
          text: subPage.text,
          totalLinks:
            subPage.links.length
        })

      const aiRecommendations =
        await generateAIRecommendations(
          analysis
        )

      crawledPages.push({
        url: subPage.finalUrl || link,
        ...analysis,
        aiRecommendations
      })

    } catch (error) {

      console.error(
        "Error crawling page:",
        link,
        error
      )

    }

  }

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

  try {

    const auditData =
      await createAuditRecord({
        url,
        average_score:
          averageSeoScore,
        total_pages:
          crawledPages.length,
        total_issues:
          totalIssues,
        technical_seo:
          technicalSeo
      })

    await persistCrawledPages(
      auditData.id,
      crawledPages
    )

  } catch (error) {

    console.error(error)

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to save audit data."
    }

  }

  return {

    success: true,

    homepageAnalysis,

    technicalSeo,

    internalLinks,

    crawledPages,

    siteSummary

  }

}
