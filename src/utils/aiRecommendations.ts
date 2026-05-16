type RecommendationInput = {
  title: string
  metaDescription: string | null
  h1s?: string[]
  seoIssues?: string[]
  wordCount: number
  seoScore: number
}

export async function generateAIRecommendations(
  page: RecommendationInput
) {

  const recommendations: string[] = []

  if (
    page.seoIssues?.includes(
      "Missing meta description"
    )
  ) {

    recommendations.push(
      "Add a compelling meta description between 120–160 characters including primary keywords."
    )

  }

  if (
    page.seoIssues?.includes(
      "Multiple H1 headings found"
    )
  ) {

    recommendations.push(
      "Use only one H1 heading per page for stronger SEO structure."
    )

  }

  if (
    page.seoIssues?.includes(
      "Missing H1 heading"
    )
  ) {

    recommendations.push(
      "Add a clear H1 heading describing the page topic."
    )

  }

  if (
    page.seoIssues?.includes(
      "Low content word count"
    )
  ) {

    recommendations.push(
      "Increase content depth with more keyword-rich sections and useful information."
    )

  }

  if (
    page.seoIssues?.includes(
      "No H2 headings found"
    )
  ) {

    recommendations.push(
      "Add H2 headings to improve readability and keyword structure."
    )

  }

  if (
    page.seoIssues?.includes(
      "SEO title too short"
    )
  ) {

    recommendations.push(
      "Expand the SEO title to 50–60 characters with target keywords."
    )

  }

  if (
    page.seoIssues?.includes(
      "SEO title too long"
    )
  ) {

    recommendations.push(
      "Shorten the SEO title to under 60 characters."
    )

  }

  if (
    page.seoIssues?.includes(
      "Meta description too short"
    )
  ) {

    recommendations.push(
      "Expand the meta description for better search visibility."
    )

  }

  if (
    page.seoIssues?.includes(
      "Meta description too long"
    )
  ) {

    recommendations.push(
      "Reduce meta description length to under 160 characters."
    )

  }

  if (page.wordCount < 500) {

    recommendations.push(
      "Add more high-quality content to improve topical authority."
    )

  }

  if (page.seoScore >= 90) {

    recommendations.push(
      "This page is already well optimized. Focus on backlinks and content freshness."
    )

  }

  if (recommendations.length === 0) {

    recommendations.push(
      "No major SEO improvements required."
    )

  }

  return recommendations.join("\n\n")

}