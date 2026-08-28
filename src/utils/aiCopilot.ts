import { createServiceClient } from "@/lib/supabase/service"
import { isMissingColumnError } from "./schemaCompat"
import {
  generateGroundedResearch,
  generateStructuredJSON
} from "./aiProvider"
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
  // First ~600 chars of the page's actual extracted body text — gives
  // the AI real source content to ground brand/product/ownership facts
  // in, instead of relying solely on title/metaDescription (which are
  // often too thin to correct a stale training-data assumption).
  contentSnippet: string
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

  // detectedThemes is only ever populated by the AI provider itself
  // (see generateAIInsights) — it's always [] on this fallback path, so
  // every template below is written to read naturally with only the
  // brand name, with a themed variant used when a theme happens to be
  // available (kept for forward-compatibility, not the common case).
  const hasTheme = detectedThemes.length > 0
  const theme = detectedThemes[0]
  const themeLower = theme?.toLowerCase()

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
      title: hasTheme
        ? `A Complete Guide to ${theme}`
        : `Why Choose ${brand}: A Buyer's Guide`,
      description: hasTheme
        ? `Top-of-funnel educational content that positions ${brand} as the authority on ${themeLower} — written for prospects who are searching the problem, not yet the brand.`
        : `Top-of-funnel educational content explaining what ${brand} does and who it's for — written for prospects who don't know the brand yet.`,
      type: "blog"
    },
    {
      title: `How Customers Use ${brand}`,
      description:
        "A use-case-driven piece highlighting real outcomes, aimed at readers already comparing options.",
      type: "blog"
    },
    {
      title: `${brand}: See It in Action`,
      description: `A conversion-focused landing page demoing ${brand}'s product, built to turn organic/paid traffic into signups or demo requests.`,
      type: "landing-page"
    }
  ]

  const socialIdeas: AIInsights["socialIdeas"] = [
    {
      platform: "linkedin",
      idea: hasTheme
        ? `A post breaking down why ${themeLower} matters for ${brand}'s target customers, with a soft CTA to learn more.`
        : `A post introducing what ${brand} does and who it's built for, with a soft CTA to learn more.`
    },
    {
      platform: "twitter",
      idea: `A short thread sharing one practical tip ${brand}'s customers care about, tying back to what ${brand} offers.`
    }
  ]

  const blogSeries: AIInsights["blogSeries"] = [
    {
      seriesTitle: hasTheme
        ? `The ${brand} Guide to ${theme}`
        : `The ${brand} Buyer's Journey`,
      description: `A multi-part series turning ${brand}'s expertise into a shareable, SEO-friendly resource hub.`,
      posts: [
        {
          title: hasTheme
            ? `Part 1: What Is ${theme}, and Why It Matters`
            : `Part 1: What ${brand} Does, and Who It's For`,
          angle: "Beginner-friendly explainer for prospects new to the category."
        },
        {
          title: hasTheme
            ? `Part 2: How to Evaluate a ${theme} Solution`
            : `Part 2: What to Look for When Evaluating ${brand}`,
          angle: "Comparison-style content for prospects actively evaluating options."
        },
        {
          title: `Part 3: Getting the Most Out of ${brand}`,
          angle: "Customer-facing content deepening retention and advocacy."
        }
      ]
    }
  ]

  const socialSeries: AIInsights["socialSeries"] = [
    {
      platform: "linkedin",
      seriesTitle: `${brand} Customer Spotlight`,
      posts: [
        {
          hook: hasTheme
            ? `Meet a ${brand} customer solving ${themeLower} challenges.`
            : `Meet a ${brand} customer and the problem it solved for them.`,
          caption: "A short case-study-style post building social proof."
        },
        {
          hook: `The #1 mistake teams make before finding ${brand}.`,
          caption: `Ties a common pain point back to how ${brand} solves it.`
        }
      ]
    }
  ]

  const adCampaigns: AIInsights["adCampaigns"] = [
    {
      name: `${brand} — Qualified Lead Generation`,
      objective: hasTheme
        ? `Drive demo requests or signups from prospects actively searching for ${themeLower} solutions.`
        : `Drive demo requests or signups from prospects who fit ${brand}'s target customer profile.`,
      targetAudience: hasTheme
        ? `Decision-makers evaluating ${themeLower} options similar to what ${brand} offers.`
        : `Decision-makers evaluating options similar to what ${brand} offers.`,
      keyMessage: `See how ${brand} can help — get started in minutes.`,
      channels: ["Google Search", "LinkedIn", "Meta"]
    }
  ]

  const adSets: AIInsights["adSets"] = [
    {
      campaignName: `${brand} — Qualified Lead Generation`,
      audienceAngle: `Prospects who've shown buying intent but haven't tried ${brand} yet.`,
      creativeAngle: `Before/after or outcome-focused visual showing the value ${brand} delivers.`,
      suggestedBudgetSplit:
        "60% prospecting, 40% retargeting site visitors who didn't convert."
    }
  ]

  const landingPageIdeas: AIInsights["landingPageIdeas"] = [
    {
      title: hasTheme ? `${brand}: ${theme}` : `${brand}: See It in Action`,
      targetOffer: `A free trial, demo, or consultation with ${brand}.`,
      sections: [
        {
          name: "Hero",
          purpose: "Communicate the core value prop in one glance.",
          copyHint: `"${brand} makes it simple — see how in minutes."`
        },
        {
          name: "Social proof",
          purpose: "Build trust before asking for contact details.",
          copyHint: "Customer logos, testimonials, or a key usage stat."
        },
        {
          name: "FAQ",
          purpose:
            "Pre-empt objections and add FAQPage schema for answer-engine visibility.",
          copyHint: `Answer the top 2-3 questions prospects ask about ${brand}.`
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
    hasTheme
      ? `Publish educational content around ${themeLower} to attract organic search traffic.`
      : `Publish educational content explaining what ${brand} does to attract organic search traffic.`,
    `Share ${brand} customer wins and use cases on social media to build trust with prospects.`,
    `Expand on-site content covering ${brand}'s product to improve topical authority.`
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

  competitorResearch?: string | null

  brandProfile?: {
    businessDescription: string | null
    targetAudience: string | null
    toneOfVoice: string | null
    keyDifferentiators: string | null
  } | null
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
    pageSamples: (input.pageSamples ?? []).slice(0, 12),

    // Live web-search findings (current company name/ownership/branding,
    // real competitors and their content angles) — null when no Gemini
    // key is configured or the grounding call failed. See the system
    // prompt for how this is meant to be weighted against pageSamples.
    competitorResearch: input.competitorResearch ?? null,

    // User-authored brand context (see /settings/brand) — null for orgs
    // that haven't filled one in, in which case generation behaves
    // exactly as it did before this field existed.
    brandProfile: input.brandProfile ?? null
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
  // Best-effort live research (see generateGroundedResearch's doc comment
  // for why this has to be a separate call from the structured-JSON one
  // below). Failure here must never block the audit — it degrades to
  // null and the system prompt below already tells the model how to
  // proceed without it.
  const competitorResearch = input.siteUrl
    ? await generateGroundedResearch(
        `Using live web search, research the company/website at ${input.siteUrl} ` +
          `(likely operating under the name "${deriveBrandName(input.siteUrl)}"). ` +
          `Report three things concretely: (1) its correct, current company name ` +
          `and ownership/branding as of today — explicitly flag any recent merger, ` +
          `acquisition, spinoff, or rebrand (for example, a company that used to be ` +
          `a subsidiary of a larger corporation but has since become independent, ` +
          `or vice versa), since this kind of fact frequently goes stale in AI ` +
          `training data; (2) 3-5 real, current direct competitors in its market; ` +
          `(3) concrete, current examples of the blog posts, social content, or ` +
          `marketing angles those competitors are publishing right now. Be specific ` +
          `and current — do not rely on outdated assumptions, and say so plainly if ` +
          `you are not confident in a fact.`
      )
    : null

  const context = buildAIContext({ ...input, competitorResearch })

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
      "You are a professional SEO, AEO/AIO/GEO, and full-funnel marketing intelligence assistant producing a 360-degree digital marketing audit. Ground every finding in the specific context provided — reference the site's actual URL, page titles, meta descriptions, and pageSamples[].contentSnippet (real extracted body text) where relevant instead of generic advice that could apply to any site. Accuracy over assumption: for any factual claim about the audited company or product — its name, ownership, parent company, or branding — prioritize what pageSamples and competitorResearch actually show over your own training data, which can be outdated (for example, a company that has since been divested, renamed, or acquired). If competitorResearch is present, treat it as current, live-researched ground truth: use its named competitors and their real content/marketing angles to make contentIdeas, socialIdeas, blogSeries, socialSeries, and adCampaigns concretely competitive and current rather than generic. If brandProfile is present, write contentIdeas, socialIdeas, blogSeries, socialSeries, adCampaigns, and adSets in the stated tone of voice, targeted at the stated audience, and reflecting the stated differentiators — treat it as the voice and perspective guide for everything you generate. If brandProfile is absent or a field within it is empty, proceed exactly as you would without it. If a fact is not supported by the provided context and you are not confident it is still current, phrase it cautiously rather than asserting it outright. Return valid JSON only, matching the required structure exactly.",
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
  orgId?: string | null
  siteUrl?: string | null
  crawledPages?: {
    url?: string
    title?: string
    metaDescription?: string | null
    wordCount?: number
    seoScore?: number
    seoIssues?: string[]
    text?: string
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

// Best-effort -- a missing row or fetch error resolves to null so an org
// without a filled-in brand profile (or the anonymous-teaser path, which
// never has an orgId) generates exactly as it did before this existed.
// Uses the service client since this runs inside trusted system code
// already invoked post-auth-check by both of this function's callers,
// matching runScheduledKeywordChecks.ts's precedent.
async function fetchBrandProfile(orgId: string) {
  try {

    const supabase = createServiceClient()

    const { data } =
      await supabase
        .from("brand_profiles")
        .select("business_description,target_audience,tone_of_voice,key_differentiators")
        .eq("org_id", orgId)
        .maybeSingle()

    if (!data) {
      return null
    }

    return {
      businessDescription: data.business_description,
      targetAudience: data.target_audience,
      toneOfVoice: data.tone_of_voice,
      keyDifferentiators: data.key_differentiators
    }

  } catch (error) {

    console.error("Failed to fetch brand profile:", error)
    return null

  }
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
        issues: page.seoIssues ?? [],
        contentSnippet: (page.text ?? "").slice(0, 600)
      }))

    const siteUrl =
      auditData.siteUrl ?? pages[0]?.url ?? null

    const brandProfile =
      auditData.orgId
        ? await fetchBrandProfile(auditData.orgId)
        : null

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
        pageSamples,
        brandProfile
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
