import { supabase } from "@/lib/supabase"

export type AIInsights = {
  executiveSummary: string

  regressionExplanation: string

  priorityActions: {
    title: string
    reason: string
    severity: "high" | "medium" | "low"
  }[]

  contentIdeas: {
    title: string
    description: string
    type: "blog" | "social" | "landing-page"
  }[]

  socialIdeas: {
    platform: "linkedin" | "twitter" | "instagram"
    idea: string
  }[]

  weeklyFocus: string

  marketingOpportunities: string[]

  detectedThemes: string[]

  generatedAt: string

  source: "ai" | "fallback"
}
type FallbackInput = {
  seoScore: number
  healthStatus: string
  totalIssues: number
  topIssues: string[]
  regressions?: string[]
  detectedThemes?: string[]
}

export function generateFallbackInsights(
  input: FallbackInput
): AIInsights {
  const {
    seoScore,
    topIssues,
    regressions = [],
    detectedThemes = []
  } = input

  const executiveSummary =
    seoScore >= 85
      ? "Your website SEO health is strong overall with only minor optimization opportunities."
      : seoScore >= 70
      ? "Your website SEO performance is stable, but several improvements could strengthen search visibility."
      : "Your website SEO health needs attention due to technical and content-related issues affecting visibility."

  const regressionExplanation =
    regressions.length > 0
      ? regressions.join(". ")
      : "No major SEO regressions were detected in recent audits."

  const priorityActions = topIssues.slice(0, 3).map((issue, index) => ({
    title: issue,
    reason: `Detected issue impacting SEO performance and crawl quality.`,
    severity:
      index === 0
        ? "high"
        : index === 1
        ? "medium"
        : "low"
  })) as AIInsights["priorityActions"]

  const contentIdeas: AIInsights["contentIdeas"] = [
    {
      title: "Technical SEO Checklist for Better Rankings",
      description:
        "Educational content explaining SEO best practices and technical optimization.",
      type: "blog"
    },
    {
      title: "Common SEO Mistakes Businesses Still Make",
      description:
        "Content targeting recurring SEO problems detected during audits.",
      type: "blog"
    }
  ]

  const socialIdeas: AIInsights["socialIdeas"] = [
    {
      platform: "linkedin",
      idea:
        "5 SEO mistakes businesses still make and how to fix them."
    },
    {
      platform: "twitter",
      idea:
        "Quick SEO wins that can improve website visibility this week."
    }
  ]

  const weeklyFocus =
    topIssues.length > 0
      ? `Focus this week on resolving: ${topIssues[0]}.`
      : "Focus this week on improving content quality and metadata consistency."

  const marketingOpportunities = [
    "Create educational SEO-focused blog content.",
    "Publish social media tips related to technical SEO improvements.",
    "Expand website content targeting search visibility improvements."
  ]

  return {
    executiveSummary,
    regressionExplanation,
    priorityActions,
    contentIdeas,
    socialIdeas,
    weeklyFocus,
    marketingOpportunities,
    detectedThemes,
    generatedAt: new Date().toISOString(),
    source: "fallback"
  }
}

type AIContextInput = {
  seoScore: number
  healthStatus: string
  totalIssues: number

  topIssues: string[]

  regressions?: string[]

  detectedThemes?: string[]

  crawlDiagnostics?: {
    slow: boolean
    durationMs?: number
    failureReason?: string | null
  }
}

export function buildAIContext(
  input: AIContextInput
) {
  return {
    seoScore: input.seoScore,

    healthStatus: input.healthStatus,

    totalIssues: input.totalIssues,

    topIssues: input.topIssues.slice(0, 5),

    regressions: input.regressions ?? [],

    detectedThemes: input.detectedThemes ?? [],

    crawlDiagnostics: {
      slow: input.crawlDiagnostics?.slow ?? false,

      durationMs:
        input.crawlDiagnostics?.durationMs ?? null,

      failureReason:
        input.crawlDiagnostics?.failureReason ?? null
    }
  }
}

export async function generateAIInsights(
  input: AIContextInput
): Promise<AIInsights> {
  const context = buildAIContext(input)

  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return generateFallbackInsights({
      seoScore: context.seoScore,
      healthStatus: context.healthStatus,
      totalIssues: context.totalIssues,
      topIssues: context.topIssues,
      regressions: context.regressions,
      detectedThemes: context.detectedThemes
    })
  }

  try {
    const prompt = `
You are an AI SEO and marketing copilot.

Generate structured SEO marketing insights based ONLY on the provided context.

Return valid JSON only.

Context:
${JSON.stringify(context, null, 2)}

Required JSON structure:
{
  "executiveSummary": "string",
  "regressionExplanation": "string",
  "priorityActions": [
    {
      "title": "string",
      "reason": "string",
      "severity": "high | medium | low"
    }
  ],
  "contentIdeas": [
    {
      "title": "string",
      "description": "string",
      "type": "blog | social | landing-page"
    }
  ],
  "socialIdeas": [
    {
      "platform": "linkedin | twitter | instagram",
      "idea": "string"
    }
  ],
  "weeklyFocus": "string",
  "marketingOpportunities": ["string"],
  "detectedThemes": ["string"]
}
`

    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.4,
          messages: [
            {
              role: "system",
              content:
                "You are a professional SEO and marketing intelligence assistant."
            },
            {
              role: "user",
              content: prompt
            }
          ]
        })
      }
    )

    if (!response.ok) {
      throw new Error("OpenAI request failed")
    }

    const data = await response.json()

    const content =
      data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error("Empty AI response")
    }

    const parsed = JSON.parse(content)

    return {
      executiveSummary:
        parsed.executiveSummary ??
        "AI summary unavailable.",

      regressionExplanation:
        parsed.regressionExplanation ??
        "No regression explanation available.",

      priorityActions:
        parsed.priorityActions ?? [],

      contentIdeas:
        parsed.contentIdeas ?? [],

      socialIdeas:
        parsed.socialIdeas ?? [],

      weeklyFocus:
        parsed.weeklyFocus ??
        "Focus on improving overall SEO quality.",

      marketingOpportunities:
        parsed.marketingOpportunities ?? [],

      detectedThemes:
        parsed.detectedThemes ??
        context.detectedThemes,

      generatedAt: new Date().toISOString(),

      source: "ai"
    }
  } catch (error) {
    console.error(
      "AI insight generation failed:",
      error
    )

    return generateFallbackInsights({
      seoScore: context.seoScore,
      healthStatus: context.healthStatus,
      totalIssues: context.totalIssues,
      topIssues: context.topIssues,
      regressions: context.regressions,
      detectedThemes: context.detectedThemes
    })
  }
}

function isMissingAIInsightsColumn(
  message: string
) {
  const normalized =
    message.toLowerCase()

  return (
    normalized.includes("ai_insights") ||
    normalized.includes("schema cache")
  )
}

export async function persistAIInsights(
  auditId: string | null | undefined,
  aiInsights: AIInsights
) {
  if (!auditId) {
    return
  }

  const { error } =
    await supabase
      .from("audits")
      .update({
        ai_insights: aiInsights
      })
      .eq("id", auditId)

  if (!error) {
    return
  }

  if (isMissingAIInsightsColumn(error.message)) {
    console.warn(
      "ai_insights column is missing on audits; continuing without persisted AI insights."
    )

    return
  }

  console.error(
    "Failed to persist AI insights:",
    error
  )
}

type AuditForInsights = {
  auditId?: string | null
  crawledPages?: { seoIssues?: string[] }[]
  siteSummary?: {
    averageSeoScore?: number
    totalIssues?: number
  }
  isSlow?: boolean
  durationMs?: number | null
  failureReason?: string | null
}

/**
 * Generates AI insights for a completed audit and persists them. Shared
 * by every code path that produces a successful audit (manual analyze
 * requests and the scheduled-audit cron job) so insights are never
 * generated for one path and silently skipped for another.
 */
export async function generateAndPersistAuditInsights(
  auditData: AuditForInsights
): Promise<AIInsights | null> {
  try {
    const topIssues =
      (auditData.crawledPages || [])
        .flatMap(
          (page) => page.seoIssues || []
        )
        .filter(
          (issue, index, issues) =>
            issues.indexOf(issue) === index
        )

    const seoScore =
      auditData.siteSummary
        ?.averageSeoScore ?? 0

    const totalIssues =
      auditData.siteSummary
        ?.totalIssues ?? 0

    const healthStatus =
      seoScore >= 85
        ? "Stable"
        : seoScore >= 70
          ? "Warning"
          : "Critical"

    const aiInsights =
      await generateAIInsights({
        seoScore,
        healthStatus,
        totalIssues,
        topIssues,
        regressions: [],
        detectedThemes: [],
        crawlDiagnostics: {
          slow: auditData.isSlow ?? false,
          durationMs:
            auditData.durationMs ?? undefined,
          failureReason:
            auditData.failureReason ?? null
        }
      })

    await persistAIInsights(
      auditData.auditId,
      aiInsights
    )

    return aiInsights
  } catch (error) {
    console.error(
      "AI insight generation failed:",
      error
    )

    return null
  }
}
