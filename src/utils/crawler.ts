import { analyzePage } from "./analyzer"
import { analyzeTechnicalSeo } from "./technicalSeo"
import { supabase } from "@/lib/supabase"
import { generateAIRecommendations } from "./aiRecommendations"

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

export function extractInternalLinks(
  links: string[],
  baseUrl: string
) {

  const internalLinks = links.filter((link) => {

    try {

      return (
        new URL(link).hostname ===
        new URL(baseUrl).hostname
      )

    } catch {

      return false

    }

  })

  return [...new Set(internalLinks)].slice(0, 5)

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

  const internalLinks =
    extractInternalLinks(
      homepage.links,
      homepage.finalUrl
    )

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

  const technicalSeo =
    await analyzeTechnicalSeo(
      homepage.html,
      homepage.finalUrl
    )

  const crawledPages: CrawledPage[] = []

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
        url: link,
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
    crawledPages.length > 0
      ? Math.round(
          crawledPages.reduce(
            (acc, page) =>
              acc + page.seoScore,
            0
          ) / crawledPages.length
        )
      : homepageAnalysis.seoScore

  const totalIssues =
    crawledPages.reduce(
      (acc, page) =>
        acc + page.seoIssues.length,
      0
    )

  const bestPage =
    crawledPages.length > 0
      ? crawledPages.reduce(
          (best, current) =>
            current.seoScore >
            best.seoScore
              ? current
              : best
        )
      : {
          url,
          seoScore:
            homepageAnalysis.seoScore
        }

  const worstPage =
    crawledPages.length > 0
      ? crawledPages.reduce(
          (worst, current) =>
            current.seoScore <
            worst.seoScore
              ? current
              : worst
        )
      : {
          url,
          seoScore:
            homepageAnalysis.seoScore
        }

  const siteSummary = {

    totalPages:
      crawledPages.length,

    averageSeoScore,

    totalIssues,

    bestPage,

    worstPage

  }

  const { data: auditData } =
    await supabase
      .from("audits")
      .insert({
        url,
        average_score:
          averageSeoScore,
        total_pages:
          crawledPages.length,
        total_issues:
          totalIssues
      })
      .select()
      .single()

  if (auditData) {

    const pagesToInsert =
      crawledPages.map((page) => ({

        audit_id: auditData.id,

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

    if (pagesToInsert.length > 0) {

      await supabase
        .from("crawled_pages")
        .insert(pagesToInsert)

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
