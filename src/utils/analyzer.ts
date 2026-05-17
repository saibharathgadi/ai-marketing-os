export type AnalyzePageInput = {
  title: string
  metaDescription: string | null
  h1s: string[]
  h2s: string[]
  h3s: string[]
  text: string
  totalLinks: number
}

export function analyzePage(
  data: AnalyzePageInput
) {

  const {
    title,
    metaDescription,
    h1s,
    h2s,
    h3s,
    text,
    totalLinks
  } = data

  const wordCount =
    text.trim()
      ? text.trim().split(/\s+/).length
      : 0

  const seoIssues: string[] = []

  let seoScore = 100

  if (!metaDescription) {
    seoIssues.push(
      "Missing meta description"
    )
    seoScore -= 10
  }

  if (h1s.length === 0) {
    seoIssues.push(
      "Missing H1 heading"
    )
    seoScore -= 10
  }

  if (h1s.length > 1) {
    seoIssues.push(
      "Multiple H1 headings found"
    )
    seoScore -= 10
  }

  if (h2s.length === 0) {
    seoIssues.push(
      "No H2 headings found"
    )
    seoScore -= 5
  }

  if (wordCount < 300) {
    seoIssues.push(
      "Low content word count"
    )
    seoScore -= 10
  }

  if (title.length < 30) {
    seoIssues.push(
      "SEO title too short"
    )
    seoScore -= 5
  }

  if (title.length > 60) {
    seoIssues.push(
      "SEO title too long"
    )
    seoScore -= 5
  }

  if (
    metaDescription &&
    metaDescription.length < 120
  ) {
    seoIssues.push(
      "Meta description too short"
    )
    seoScore -= 5
  }

  if (
    metaDescription &&
    metaDescription.length > 160
  ) {
    seoIssues.push(
      "Meta description too long"
    )
    seoScore -= 5
  }

  if (seoScore < 0) {
    seoScore = 0
  }

  return {
    title,
    metaDescription,
    h1s,
    h2s,
    h3s,
    totalLinks,
    wordCount,
    seoIssues,
    seoScore
  }

}
