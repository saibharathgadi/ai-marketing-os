import { deriveBrandName } from "./aiCopilot"

// Loose/partial on purpose, same rationale as pdfReport.ts's
// AiInsightsReportData: older or AI-generation-failed audits may have a
// null/partial ai_insights, and this generator must still produce
// something reasonable.
type LlmsTxtAudit = {
  url: string
  ai_insights?: { executiveSummary?: string } | null
}

type LlmsTxtPage = {
  url: string
  title?: string | null
  meta_description?: string | null
}

export function generateLlmsTxt(
  audit: LlmsTxtAudit,
  pages: LlmsTxtPage[]
): string {
  const brandName = deriveBrandName(audit.url)

  const summary =
    audit.ai_insights?.executiveSummary ||
    `SEO and content audit summary for ${audit.url}.`

  const pageLines = pages
    .map((page) => {
      const title = page.title || page.url
      const description = page.meta_description || "No description available."
      return `- [${title}](${page.url}): ${description}`
    })
    .join("\n")

  return [
    `# ${brandName}`,
    "",
    `> ${summary}`,
    "",
    "## Pages",
    "",
    pageLines || "No pages available."
  ].join("\n")
}
