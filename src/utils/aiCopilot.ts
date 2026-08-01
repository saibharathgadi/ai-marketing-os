import { createServiceClient } from "@/lib/supabase/service"
import { isMissingColumnError } from "./schemaCompat"
import { generateStructuredJSON } from "./aiProvider"
import type { AnswerEngineSeoResult } from "./answerEngineSeo"

export type AIInsights = {
  executiveSummary: string

  regressionExplanation: string

  priorityActions: {
    title: string
    reason: string
    severity: "high" | "medium" | "low"
  }[]

  rootCauseSummary: {
    issue: string
    type: "Technical" | "Structure" | "Content" | "Authority"
    severity: "Critical" | "High" | "Medium" | "Low"
  }[]

  keywordClusters: {
    cluster: string
    exampleKeywords: string[]
    funnelStage: "Top" | "Mid" | "Bottom"
    serpTarget: string
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

  blogSeries: {
    seriesTitle: string
    description: string
    posts: {
      title: string
      angle: string
    }[]
  }[]

  socialSeries: {
    platform: "linkedin" | "twitter" | "instagram" | "tiktok"
    seriesTitle: string
    posts: {
      hook: string
      caption: string
    }[]
  }[]

  adCampaigns: {
    name: string
    objective: string
    targetAudience: string
    keyMessage: string
    channels: string[]
  }[]

  adSets: {
    campaignName: string
    audienceAngle: string
    creativeAngle: string
    suggestedBudgetSplit: string
  }[]

  landingPageIdeas: {
    title: string
    targetOffer: string
    sections: {
      name: string
      purpose: string
      copyHint: string
    }[]
  }[]

  roadmap90Day: {
    zeroToTwoWeeks: string[]
    thirtyDays: string[]
    sixtyToNinetyDays: string[]
  }

  kpiFramework: {
    area: string
    metric: string
    baseline: string
    target: string
  }[]

  weeklyFocus: string

  marketingOpportunities: string[]

  detectedThemes: string[]

  generatedAt: string

  source: "ai" | "fallback"
}

type PageSample = {
  url: string
  title: string
  metaDescription: string | null
  wordCount: number
  seoScore: number
  issues: string[]
}

function deriveBrandName(siteUrl?: string | null) {
  if (!siteUrl) {
    return "This site"
  }

  try {
    const hostname = new URL(siteUrl).hostname
      .replace(/^www\./, "")
      .split(".")[0]

    if (!hostname) {
      return "This site"
    }

    return hostname.charAt(0).toUpperCase() + hostname.slice(1)
  } catch {
    return "This site"
  }
}

const issueClassification: Record<
  string,
  { type: AIInsights["rootCauseSummary"][number]["type"]; severity: AIInsights["rootCauseSummary"][number]["severity"] }
> = {
  "Missing meta description": { type: "Structure", severity: "High" },
  "Missing H1 heading": { type: "Structure", severity: "High" },
  "Multiple H1 headings found": { type: "Structure", severity: "Medium" },
  "No H2 headings found": { type: "Structure", severity: "Low" },
  "Low content word count": { type: "Content", severity: "High" },
  "SEO title too short": { type: "Structure", severity: "Medium" },
  "SEO title too long": { type: "Structure", severity: "Medium" },
  "Meta description too short": { type: "Structure", severity: "Low" },
  "Meta description too long": { type: "Structure", severity: "Low" }
}

function buildFallbackRootCauseSummary(
  topIssues: string[],
  answerEngineSeo?: AnswerEngineSeoResult | null
): AIInsights["rootCauseSummary"] {
  const rows: AIInsights["rootCauseSummary"] = topIssues.map((issue) => ({
    issue,
    type: issueClassification[issue]?.type ?? "Structure",
    severity: issueClassification[issue]?.severity ?? "Medium"
  }))

  if (answerEngineSeo && !answerEngineSeo.aio.aiCrawlersAllowed) {
    rows.push({
      issue:
        "robots.txt blocks known AI crawlers (GPTBot, ClaudeBot, Google-Extended, etc.)",
      type: "Technical",
      severity: "Critical"
    })
  }

  if (answerEngineSeo && !answerEngineSeo.aeo.faqSchema) {
    rows.push({
      issue: "No FAQPage structured data / answer capsules anywhere on the site",
      type: "Structure",
      severity: "Critical"
    })
  }

  if (answerEngineSeo && !answerEngineSeo.geo.authorOrSourceSignals) {
    rows.push({
      issue:
        "No author/source credibility signals — weak third-party citation readiness",
      type: "Authority",
      severity: "High"
    })
  }

  if (answerEngineSeo && !answerEngineSeo.aio.llmsTxt) {
    rows.push({
      issue: "No /llms.txt guiding AI agents to key content",
      type: "Technical",
      severity: "Low"
    })
  }

  return rows
}

function buildFallbackKeywordClusters(
  brand: string,
  detectedThemes: string[]
): AIInsights["keywordClusters"] {
  const themeKeywords =
    detectedThemes.length > 0
      ? detectedThemes.slice(0, 5)
      : [`${brand} services`, `${brand} solutions`]

  return [
    {
      cluster: "Brand + Category",
      exampleKeywords: [
        `${brand} reviews`,
        `${brand} pricing`,
        `is ${brand} good`
      ],
      funnelStage: "Bottom",
      serpTarget: "Knowledge panel + brand SERP + AI-answer brand queries"
    },
    {
      cluster: "Educational / How-to",
      exampleKeywords: themeKeywords.map((theme) => `what is ${theme}`),
      funnelStage: "Top",
      serpTarget: "Featured snippet + AI Overview definition box"
    },
    {
      cluster: "Comparison / Evaluation",
      exampleKeywords: [
        `${brand} vs competitors`,
        `best alternatives to ${brand}`
      ],
      funnelStage: "Bottom",
      serpTarget: "Comparison blog content — high-value gap if none exists yet"
    }
  ]
}

function buildFallbackRoadmap(
  topIssues: string[],
  answerEngineSeo?: AnswerEngineSeoResult | null
): AIInsights["roadmap90Day"] {
  const zeroToTwoWeeks = topIssues.slice(0, 3).map((issue) => `Fix: ${issue}`)

  if (answerEngineSeo && !answerEngineSeo.aio.aiCrawlersAllowed) {
    zeroToTwoWeeks.unshift(
      "Update robots.txt to allow GPTBot, ClaudeBot, Google-Extended, and PerplexityBot"
    )
  }

  if (zeroToTwoWeeks.length === 0) {
    zeroToTwoWeeks.push(
      "Re-run this audit after your next content update to confirm no regressions"
    )
  }

  return {
    zeroToTwoWeeks,
    thirtyDays: [
      "Add FAQ sections with FAQPage schema to your highest-traffic pages",
      "Publish the first post from your blog series plan",
      "Launch the first ad campaign from your campaign ideas"
    ],
    sixtyToNinetyDays: [
      "Publish the remaining blog series and social series content",
      "Launch remaining ad campaigns and compare performance against Campaign 1",
      "Re-audit this site to confirm SEO/AEO/AIO/GEO scores have improved"
    ]
  }
}

function buildFallbackKpiFramework(
  seoScore: number,
  answerEngineSeo?: AnswerEngineSeoResult | null
): AIInsights["kpiFramework"] {
  const kpis: AIInsights["kpiFramework"] = [
    {
      area: "SEO",
      metric: "Average SEO score",
      baseline: `${seoScore}/100`,
      target: `${Math.min(100, seoScore + 15)}/100`
    }
  ]

  if (answerEngineSeo) {
    kpis.push(
      {
        area: "AEO",
        metric: "Pages with FAQPage schema + answer capsules",
        baseline: answerEngineSeo.aeo.faqSchema ? "Present" : "0",
        target: "6+ priority pages"
      },
      {
        area: "AIO",
        metric: "AI crawler access (robots.txt)",
        baseline: answerEngineSeo.aio.aiCrawlersAllowed
          ? "Allowed"
          : "Blocked",
        target: "Allowed for all major AI crawlers"
      },
      {
        area: "GEO",
        metric: "Third-party credibility signals present",
        baseline: answerEngineSeo.geo.authorOrSourceSignals
          ? "Present"
          : "None found",
        target: "Author/byline schema + 1+ external review profile"
      }
    )
  }

  kpis.push(
    {
      area: "Content",
      metric: "Blog posts published",
      baseline: "Ad hoc",
      target: "2+ per month"
    },
    {
      area: "Social",
      metric: "Posts per week",
      baseline: "Ad hoc",
      target: "3-4 per week"
    }
  )

  return kpis
}

type FallbackInput = {
  seoScore: number
  healthStatus: string
  totalIssues: number
  topIssues: string[]
  regressions?: string[]
  detectedThemes?: string[]
  answerEngineSeo?: AnswerEngineSeoResult | null
  siteUrl?: string | null
}

export function generateFallbackInsights(
  input: FallbackInput
): AIInsights {
  const {
    seoScore,
    topIssues,
    regressions = [],
    detectedThemes = [],
    answerEngineSeo,
    siteUrl
  } = input

  const brand = deriveBrandName(siteUrl)

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

  const rootCauseSummary = buildFallbackRootCauseSummary(
    topIssues,
    answerEngineSeo
  )

  const keywordClusters = buildFallbackKeywordClusters(
    brand,
    detectedThemes
  )

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
    },
    {
      title: `Landing Page: See ${brand}'s Marketing Health Score`,
      description:
        "A conversion-focused landing page pitching a free audit as the entry point to your funnel.",
      type: "landing-page"
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

  const blogSeries: AIInsights["blogSeries"] = [
    {
      seriesTitle: "The Complete SEO Health Series",
      description:
        "A multi-part series turning each recurring audit finding into a standalone, shareable guide.",
      posts: [
        {
          title: "Part 1: Why Meta Descriptions Still Matter in 2026",
          angle: "Beginner-friendly explainer with before/after examples."
        },
        {
          title: "Part 2: Fixing Your Heading Structure for SEO and AI Search",
          angle: "Technical walkthrough targeting site owners and developers."
        },
        {
          title: "Part 3: How to Build Topical Authority With Thin Content",
          angle: "Content-strategy angle for marketing teams."
        }
      ]
    }
  ]

  const socialSeries: AIInsights["socialSeries"] = [
    {
      platform: "linkedin",
      seriesTitle: "SEO Myth-Busting Week",
      posts: [
        {
          hook: "Myth: More keywords always means better rankings.",
          caption:
            "Reality check on keyword stuffing vs. topical relevance, with a CTA to get a free audit."
        },
        {
          hook: "Myth: Once you rank #1, you're done.",
          caption:
            "Why regression monitoring matters, tying into the product's monitoring feature."
        }
      ]
    }
  ]

  const adCampaigns: AIInsights["adCampaigns"] = [
    {
      name: "Free SEO Audit — Awareness Push",
      objective: "Top-of-funnel lead generation via a free audit offer.",
      targetAudience:
        "Marketing managers and founders at small-to-mid-size businesses.",
      keyMessage:
        "Find out what's silently hurting your search rankings — in under 60 seconds.",
      channels: ["Google Search", "LinkedIn", "Meta"]
    }
  ]

  const adSets: AIInsights["adSets"] = [
    {
      campaignName: "Free SEO Audit — Awareness Push",
      audienceAngle: "Site owners who haven't audited their site in 6+ months.",
      creativeAngle:
        "Before/after score comparison visual with a single-click CTA.",
      suggestedBudgetSplit:
        "60% prospecting, 40% retargeting site visitors who didn't convert."
    }
  ]

  const landingPageIdeas: AIInsights["landingPageIdeas"] = [
    {
      title: "Free Website SEO & AI-Readiness Audit",
      targetOffer: "Instant, free audit report as a lead magnet.",
      sections: [
        {
          name: "Hero",
          purpose: "Communicate the core value prop in one glance.",
          copyHint:
            "\"Is your website ready for search and AI answer engines? Find out free.\""
        },
        {
          name: "Social proof",
          purpose: "Build trust before asking for the URL.",
          copyHint: "Logos or a short stat about audits run."
        },
        {
          name: "FAQ",
          purpose:
            "Pre-empt objections and add FAQPage schema for answer-engine visibility.",
          copyHint:
            "Answer \"How long does it take?\" and \"Is it really free?\""
        }
      ]
    }
  ]

  const roadmap90Day = buildFallbackRoadmap(topIssues, answerEngineSeo)

  const kpiFramework = buildFallbackKpiFramework(seoScore, answerEngineSeo)

  const weeklyFocus =
    topIssues.length > 0
      ? `Focus this week on resolving: ${topIssues[0]}.`
      : "Focus this week on improving content quality and metadata consistency."

  const marketingOpportunities = [
    "Create educational SEO-focused blog content.",
    "Publish social media tips related to technical SEO improvements.",
    "Expand website content targeting search visibility improvements."
  ]

  if (answerEngineSeo && !answerEngineSeo.aeo.faqSchema) {
    marketingOpportunities.push(
      "Add an FAQ section with FAQPage schema to become eligible for AI answer-engine citations."
    )
  }

  if (answerEngineSeo && !answerEngineSeo.aio.aiCrawlersAllowed) {
    marketingOpportunities.push(
      "Review robots.txt — AI crawlers appear to be blocked, which excludes the site from ChatGPT/Perplexity citations."
    )
  }

  return {
    executiveSummary,
    regressionExplanation,
    priorityActions,
    rootCauseSummary,
    keywordClusters,
    contentIdeas,
    socialIdeas,
    blogSeries,
    socialSeries,
    adCampaigns,
    adSets,
    landingPageIdeas,
    roadmap90Day,
    kpiFramework,
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

  answerEngineSeo?: AnswerEngineSeoResult | null

  siteUrl?: string | null

  pageSamples?: PageSample[]
}

export function buildAIContext(
  input: AIContextInput
) {
  return {
    siteUrl: input.siteUrl ?? null,

    seoScore: input.seoScore,

    healthStatus: input.healthStatus,

    totalIssues: input.totalIssues,

    topIssues: input.topIssues.slice(0, 8),

    regressions: input.regressions ?? [],

    detectedThemes: input.detectedThemes ?? [],

    crawlDiagnostics: {
      slow: input.crawlDiagnostics?.slow ?? false,

      durationMs:
        input.crawlDiagnostics?.durationMs ?? null,

      failureReason:
        input.crawlDiagnostics?.failureReason ?? null
    },

    answerEngineSeo: input.answerEngineSeo
      ? {
          aeoScore: input.answerEngineSeo.aeo.score,
          aeoIssues: input.answerEngineSeo.aeo.issues,
          aioScore: input.answerEngineSeo.aio.score,
          aioIssues: input.answerEngineSeo.aio.issues,
          geoScore: input.answerEngineSeo.geo.score,
          geoIssues: input.answerEngineSeo.geo.issues
        }
      : null,

    // Real per-page samples (not just aggregate issue-type labels) so
    // the AI can ground findings in this site's actual content — e.g.
    // quoting a genuinely thin meta description — rather than producing
    // generic, could-be-any-site advice.
    pageSamples: (input.pageSamples ?? []).slice(0, 12)
  }
}

const requiredJsonStructure = `{
  "executiveSummary": "string",
  "regressionExplanation": "string",
  "priorityActions": [
    { "title": "string", "reason": "string", "severity": "high | medium | low" }
  ],
  "rootCauseSummary": [
    { "issue": "string", "type": "Technical | Structure | Content | Authority", "severity": "Critical | High | Medium | Low" }
  ],
  "keywordClusters": [
    { "cluster": "string", "exampleKeywords": ["string"], "funnelStage": "Top | Mid | Bottom", "serpTarget": "string" }
  ],
  "contentIdeas": [
    { "title": "string", "description": "string", "type": "blog | social | landing-page" }
  ],
  "socialIdeas": [
    { "platform": "linkedin | twitter | instagram", "idea": "string" }
  ],
  "blogSeries": [
    {
      "seriesTitle": "string",
      "description": "string",
      "posts": [{ "title": "string", "angle": "string" }]
    }
  ],
  "socialSeries": [
    {
      "platform": "linkedin | twitter | instagram | tiktok",
      "seriesTitle": "string",
      "posts": [{ "hook": "string", "caption": "string" }]
    }
  ],
  "adCampaigns": [
    {
      "name": "string",
      "objective": "string",
      "targetAudience": "string",
      "keyMessage": "string",
      "channels": ["string"]
    }
  ],
  "adSets": [
    {
      "campaignName": "string",
      "audienceAngle": "string",
      "creativeAngle": "string",
      "suggestedBudgetSplit": "string"
    }
  ],
  "landingPageIdeas": [
    {
      "title": "string",
      "targetOffer": "string",
      "sections": [{ "name": "string", "purpose": "string", "copyHint": "string" }]
    }
  ],
  "roadmap90Day": {
    "zeroToTwoWeeks": ["string"],
    "thirtyDays": ["string"],
    "sixtyToNinetyDays": ["string"]
  },
  "kpiFramework": [
    { "area": "string", "metric": "string", "baseline": "string", "target": "string" }
  ],
  "weeklyFocus": "string",
  "marketingOpportunities": ["string"],
  "detectedThemes": ["string"]
}`

export async function generateAIInsights(
  input: AIContextInput
): Promise<AIInsights> {
  const context = buildAIContext(input)

  const fallbackArgs = {
    seoScore: context.seoScore,
    healthStatus: context.healthStatus,
    totalIssues: context.totalIssues,
    topIssues: context.topIssues,
    regressions: context.regressions,
    detectedThemes: context.detectedThemes,
    answerEngineSeo: input.answerEngineSeo ?? null,
    siteUrl: context.siteUrl
  }

  const result = await generateStructuredJSON({
    systemPrompt:
      "You are a professional SEO, AEO/AIO/GEO, and full-funnel marketing intelligence assistant producing a 360-degree digital marketing audit. Ground every finding in the specific context provided — reference the site's actual URL, page titles, and meta descriptions where relevant instead of generic advice that could apply to any site. Return valid JSON only, matching the required structure exactly.",
    userPrompt: `Context:\n${JSON.stringify(
      context,
      null,
      2
    )}\n\nRequired JSON structure:\n${requiredJsonStructure}`
  })

  if (!result) {
    return generateFallbackInsights(fallbackArgs)
  }

  try {
    const parsed = result.data

    return {
      executiveSummary:
        (parsed.executiveSummary as string) ??
        "AI summary unavailable.",

      regressionExplanation:
        (parsed.regressionExplanation as string) ??
        "No regression explanation available.",

      priorityActions:
        (parsed.priorityActions as AIInsights["priorityActions"]) ?? [],

      rootCauseSummary:
        (parsed.rootCauseSummary as AIInsights["rootCauseSummary"]) ?? [],

      keywordClusters:
        (parsed.keywordClusters as AIInsights["keywordClusters"]) ?? [],

      contentIdeas:
        (parsed.contentIdeas as AIInsights["contentIdeas"]) ?? [],

      socialIdeas:
        (parsed.socialIdeas as AIInsights["socialIdeas"]) ?? [],

      blogSeries:
        (parsed.blogSeries as AIInsights["blogSeries"]) ?? [],

      socialSeries:
        (parsed.socialSeries as AIInsights["socialSeries"]) ?? [],

      adCampaigns:
        (parsed.adCampaigns as AIInsights["adCampaigns"]) ?? [],

      adSets: (parsed.adSets as AIInsights["adSets"]) ?? [],

      landingPageIdeas:
        (parsed.landingPageIdeas as AIInsights["landingPageIdeas"]) ?? [],

      roadmap90Day:
        (parsed.roadmap90Day as AIInsights["roadmap90Day"]) ?? {
          zeroToTwoWeeks: [],
          thirtyDays: [],
          sixtyToNinetyDays: []
        },

      kpiFramework:
        (parsed.kpiFramework as AIInsights["kpiFramework"]) ?? [],

      weeklyFocus:
        (parsed.weeklyFocus as string) ??
        "Focus on improving overall SEO quality.",

      marketingOpportunities:
        (parsed.marketingOpportunities as string[]) ?? [],

      detectedThemes:
        (parsed.detectedThemes as string[]) ?? context.detectedThemes,

      generatedAt: new Date().toISOString(),

      source: "ai"
    }
  } catch (error) {
    console.error(
      "AI insight generation failed:",
      error
    )

    return generateFallbackInsights(fallbackArgs)
  }
}

export async function persistAIInsights(
  auditId: string | null | undefined,
  aiInsights: AIInsights
) {
  if (!auditId) {
    return
  }

  const supabase = createServiceClient()

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

  if (isMissingColumnError(error.message, ["ai_insights"])) {
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
  siteUrl?: string | null
  crawledPages?: {
    url?: string
    title?: string
    metaDescription?: string | null
    wordCount?: number
    seoScore?: number
    seoIssues?: string[]
  }[]
  siteSummary?: {
    averageSeoScore?: number
    totalIssues?: number
  }
  isSlow?: boolean
  durationMs?: number | null
  failureReason?: string | null
  technicalSeo?: Pick<
    AnswerEngineSeoResult,
    "aeo" | "aio" | "geo"
  > | null
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
    const pages = auditData.crawledPages || []

    const topIssues =
      pages
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

    // Ground the AI prompt in real pages: worst-scoring first, since
    // those are the most actionable to call out specifically.
    const pageSamples: PageSample[] = [...pages]
      .sort(
        (a, b) =>
          (a.seoScore ?? 100) - (b.seoScore ?? 100)
      )
      .slice(0, 12)
      .map((page) => ({
        url: page.url ?? "",
        title: page.title ?? "",
        metaDescription: page.metaDescription ?? null,
        wordCount: page.wordCount ?? 0,
        seoScore: page.seoScore ?? 0,
        issues: page.seoIssues ?? []
      }))

    const siteUrl =
      auditData.siteUrl ?? pages[0]?.url ?? null

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
        },
        answerEngineSeo:
          auditData.technicalSeo ?? null,
        siteUrl,
        pageSamples
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
