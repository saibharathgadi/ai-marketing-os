import type { analyzePage } from "./analyzer"

type SummaryPage = ReturnType<typeof analyzePage> & {
  url: string
}

export function generateSiteSummary(
  crawledPages: SummaryPage[]
) {

  const totalPages =
    crawledPages.length

  const totalScore =
    crawledPages.reduce(
      (sum, page) =>
        sum + page.seoScore,
      0
    )

  const averageSeoScore =
    totalPages > 0
      ? Math.round(totalScore / totalPages)
      : 0

  const totalIssues =
    crawledPages.reduce(
      (sum, page) =>
        sum + page.seoIssues.length,
      0
    )

  const sortedPages =
    [...crawledPages].sort(
      (a, b) =>
        b.seoScore - a.seoScore
    )

  const bestPage =
    sortedPages[0] || null

  const worstPage =
    sortedPages[
      sortedPages.length - 1
    ] || null

  return {
    totalPages,
    averageSeoScore,
    totalIssues,
    bestPage,
    worstPage
  }
}
