import { fetchWithSsrfProtection } from "./urlValidation"

// Bots that retrieve/cite content in real time for AI answer engines
// (ChatGPT, Claude, Perplexity, Google AI Overviews). Blocking these
// directly hurts AEO/GEO citation eligibility, which is what this
// check is meant to catch.
//
// Deliberately excludes training-data crawlers (CCBot, Bytespider,
// meta-externalagent, etc.) — those scrape content to build model
// training datasets, not to answer live queries. Blocking them is a
// common, legitimate publisher choice (opting out of having your
// content used for training) with no bearing on whether the site can
// be cited by an AI answer engine, so it must never be flagged as an
// AIO problem here.
const answerEngineCrawlerUserAgents = [
  "gptbot",
  "chatgpt-user",
  "claudebot",
  "anthropic-ai",
  "perplexitybot",
  "google-extended"
]

async function fetchTextSafely(url: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

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

async function checkUrlExists(url: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetchWithSsrfProtection(url, {
      signal: controller.signal
    })

    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

// Canonical display casing for the issue message — matched against
// the lowercased agent names the parser below produces.
const answerEngineCrawlerDisplayNames: Record<string, string> = {
  gptbot: "GPTBot",
  "chatgpt-user": "ChatGPT-User",
  claudebot: "ClaudeBot",
  "anthropic-ai": "anthropic-ai",
  perplexitybot: "PerplexityBot",
  "google-extended": "Google-Extended"
}

/**
 * Heuristic parse of robots.txt: returns the subset of
 * `answerEngineCrawlerUserAgents` that have an explicit "Disallow: /"
 * rule blocking the entire site (not the generic "*" wildcard, which
 * is usually just normal crawl-budget hygiene). Named training-data
 * crawlers being blocked is intentionally invisible to this check —
 * see the comment on `answerEngineCrawlerUserAgents`.
 */
function findBlockedAnswerEngineCrawlers(robotsText: string) {
  let currentAgents: string[] = []
  let lastLineWasRule = false
  const blockedAgents = new Set<string>()

  for (const rawLine of robotsText.split("\n")) {
    const line = rawLine.split("#")[0].trim()

    if (!line) {
      continue
    }

    const [rawKey, ...rest] = line.split(":")
    const key = rawKey.trim().toLowerCase()
    const value = rest.join(":").trim()

    if (key === "user-agent") {
      if (lastLineWasRule) {
        currentAgents = []
      }

      currentAgents.push(value.toLowerCase())
      lastLineWasRule = false
      continue
    }

    if (key === "disallow") {
      lastLineWasRule = true

      if (value === "/") {
        for (const agent of currentAgents) {
          if (answerEngineCrawlerUserAgents.includes(agent)) {
            blockedAgents.add(agent)
          }
        }
      }

      continue
    }

    if (key === "allow") {
      lastLineWasRule = true
    }
  }

  return [...blockedAgents]
}

export type AnswerEngineSeoResult = {
  aeo: {
    score: number
    faqSchema: boolean
    howToSchema: boolean
    questionHeadings: boolean
    issues: string[]
  }
  aio: {
    score: number
    aiCrawlersAllowed: boolean
    llmsTxt: boolean
    semanticHeadingOrder: boolean
    issues: string[]
  }
  geo: {
    score: number
    hasStats: boolean
    hasListsOrTables: boolean
    authorOrSourceSignals: boolean
    issues: string[]
  }
}

type AnswerEngineSeoInput = {
  html: string
  text: string
  baseUrl: string
  h1s: string[]
  h2s: string[]
  h3s: string[]
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, score))
}

export async function analyzeAnswerEngineSeo(
  input: AnswerEngineSeoInput
): Promise<AnswerEngineSeoResult> {
  const { html, text, baseUrl, h1s, h2s, h3s } = input

  const origin = new URL(baseUrl).origin

  // ---- AEO: answer-engine optimization ----

  const faqSchema =
    /"@type"\s*:\s*"faqpage"/i.test(html)

  const howToSchema =
    /"@type"\s*:\s*"howto"/i.test(html)

  const allHeadings = [...h1s, ...h2s, ...h3s]

  const questionHeadings = allHeadings.some((heading) =>
    heading.trim().endsWith("?")
  )

  const aeoIssues: string[] = []
  let aeoScore = 100

  if (!faqSchema) {
    aeoIssues.push(
      "No FAQPage structured data found — add an FAQ section with FAQPage schema so AI answer engines (Google AI Overviews, ChatGPT, Perplexity) can extract direct answers."
    )
    aeoScore -= 25
  }

  if (!questionHeadings) {
    aeoIssues.push(
      "No question-style headings found — answer engines favor content structured around direct questions (e.g. \"What is...?\", \"How do I...?\")."
    )
    aeoScore -= 20
  }

  if (!howToSchema) {
    aeoIssues.push(
      "No HowTo structured data found — if any content walks through a process, mark it up with HowTo schema for step-by-step answer eligibility."
    )
    aeoScore -= 10
  }

  // ---- AIO: AI-crawler / overview optimization ----

  let blockedAnswerEngineCrawlers: string[] = []
  let robotsText: string | null = null

  try {
    robotsText = await fetchTextSafely(`${origin}/robots.txt`)
  } catch {}

  if (robotsText) {
    blockedAnswerEngineCrawlers =
      findBlockedAnswerEngineCrawlers(robotsText)
  }

  const aiCrawlersAllowed = blockedAnswerEngineCrawlers.length === 0

  let llmsTxt = false

  try {
    llmsTxt = await checkUrlExists(`${origin}/llms.txt`)
  } catch {}

  const semanticHeadingOrder = !(
    (h2s.length === 0 && h3s.length > 0) ||
    (h1s.length === 0 && h2s.length > 0)
  )

  const aioIssues: string[] = []
  let aioScore = 100

  if (!aiCrawlersAllowed) {
    const blockedDisplayNames = blockedAnswerEngineCrawlers.map(
      (agent) => answerEngineCrawlerDisplayNames[agent] ?? agent
    )

    aioIssues.push(
      `robots.txt explicitly blocks these AI answer-engine crawlers: ${blockedDisplayNames.join(", ")} — this excludes the site from being cited by ChatGPT, Claude, and AI Overviews.`
    )
    aioScore -= 30
  }

  if (!llmsTxt) {
    aioIssues.push(
      "No /llms.txt found — consider publishing one to guide AI agents to your most important content."
    )
    aioScore -= 15
  }

  if (!semanticHeadingOrder) {
    aioIssues.push(
      "Heading hierarchy skips a level (e.g. H3s with no H2, or H2s with no H1) — a clean, ordered heading structure helps AI systems parse page structure correctly."
    )
    aioScore -= 20
  }

  // ---- GEO: generative-engine / LLM-citation optimization ----

  const hasStats =
    /\d+(\.\d+)?\s?%/.test(text) || /\$\s?\d/.test(text)

  const hasListsOrTables =
    /<table\b/i.test(html) ||
    /<ul\b/i.test(html) ||
    /<ol\b/i.test(html)

  const authorOrSourceSignals =
    /"@type"\s*:\s*"person"/i.test(html) ||
    /rel=["']author["']/i.test(html) ||
    /class=["'][^"']*(author|byline)[^"']*["']/i.test(html)

  const geoIssues: string[] = []
  let geoScore = 100

  if (!authorOrSourceSignals) {
    geoIssues.push(
      "No author/source credibility signals found (author schema, byline, or rel=\"author\") — generative engines weigh source credibility heavily when choosing what to cite."
    )
    geoScore -= 25
  }

  if (!hasStats) {
    geoIssues.push(
      "No statistics or figures detected in page content — data-backed claims are more likely to be quoted by generative engines."
    )
    geoScore -= 20
  }

  if (!hasListsOrTables) {
    geoIssues.push(
      "No lists or tables found — structured, scannable content (bullet lists, tables) is easier for generative engines to extract and cite verbatim."
    )
    geoScore -= 20
  }

  return {
    aeo: {
      score: clampScore(aeoScore),
      faqSchema,
      howToSchema,
      questionHeadings,
      issues: aeoIssues
    },
    aio: {
      score: clampScore(aioScore),
      aiCrawlersAllowed,
      llmsTxt,
      semanticHeadingOrder,
      issues: aioIssues
    },
    geo: {
      score: clampScore(geoScore),
      hasStats,
      hasListsOrTables,
      authorOrSourceSignals,
      issues: geoIssues
    }
  }
}
