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