import {
  PDFDocument,
  PDFPage,
  PDFFont,
  rgb,
  StandardFonts
} from "pdf-lib"

type TechnicalSeoResult = {
  robotsTxt: boolean
  sitemap: boolean
  canonical: boolean
  openGraph: boolean
  twitterCards: boolean
  schemaMarkup: boolean
}

type AuditReportRow = {
  url: string
  average_score: number
  total_pages: number
  total_issues: number
  created_at?: string | null
  technical_seo?: TechnicalSeoResult | string | null
}

type CrawledPageReportRow = {
  url: string
  title?: string | null
  meta_description?: string | null
  seo_score: number
  word_count: number
  issues?: string[] | string | null
  ai_recommendations?: string | null
}

type ReportFonts = {
  regular: PDFFont
  bold: PDFFont
}

type ReportTheme = {
  background: ReturnType<typeof rgb>
  panel: ReturnType<typeof rgb>
  panelMuted: ReturnType<typeof rgb>
  border: ReturnType<typeof rgb>
  text: ReturnType<typeof rgb>
  muted: ReturnType<typeof rgb>
  accent: ReturnType<typeof rgb>
  success: ReturnType<typeof rgb>
  warning: ReturnType<typeof rgb>
  danger: ReturnType<typeof rgb>
}

type Cursor = {
  page: PDFPage
  y: number
}

type IssueCount = {
  issue: string
  count: number
}

const pageWidth = 842
const pageHeight = 595
const margin = 44
const contentWidth = pageWidth - margin * 2
const theme: ReportTheme = {
  background: rgb(0.03, 0.04, 0.06),
  panel: rgb(0.08, 0.09, 0.12),
  panelMuted: rgb(0.11, 0.12, 0.16),
  border: rgb(0.23, 0.25, 0.31),
  text: rgb(0.95, 0.96, 0.98),
  muted: rgb(0.63, 0.66, 0.72),
  accent: rgb(0.38, 0.68, 1),
  success: rgb(0.2, 0.82, 0.5),
  warning: rgb(0.96, 0.68, 0.25),
  danger: rgb(0.96, 0.35, 0.35)
}

function cleanText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function safeText(
  value: string | number | null | undefined,
  fallback = "Not available"
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return fallback
  }

  return cleanText(String(value)) || fallback
}

function formatAuditDate(
  createdAt: string | null | undefined
) {
  if (!createdAt) {
    return "Timestamp not available"
  }

  const date = new Date(createdAt)

  if (Number.isNaN(date.getTime())) {
    return "Timestamp not available"
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC"
  }).format(date)
}

function scoreColor(score: number) {
  if (score >= 80) {
    return theme.success
  }

  if (score >= 55) {
    return theme.warning
  }

  return theme.danger
}

function scoreLabel(score: number) {
  if (score >= 80) {
    return "Strong"
  }

  if (score >= 55) {
    return "Needs work"
  }

  return "At risk"
}

function parseIssues(
  issues: string[] | string | null | undefined
) {
  if (Array.isArray(issues)) {
    return issues
      .map((issue) => safeText(issue, ""))
      .filter(Boolean)
  }

  if (!issues) {
    return []
  }

  try {
    const parsed = JSON.parse(issues) as unknown

    if (Array.isArray(parsed)) {
      return parsed
        .map((issue) => safeText(String(issue), ""))
        .filter(Boolean)
    }
  } catch {}

  return issues
    .split(",")
    .map((issue) => safeText(issue, ""))
    .filter(Boolean)
}

function parseTechnicalSeo(
  value: TechnicalSeoResult | string | null | undefined
) {
  if (!value) {
    return null
  }

  const parsed =
    typeof value === "string"
      ? parseJsonObject(value)
      : value

  if (!parsed) {
    return null
  }

  return {
    robotsTxt: Boolean(parsed.robotsTxt),
    sitemap: Boolean(parsed.sitemap),
    canonical: Boolean(parsed.canonical),
    openGraph: Boolean(parsed.openGraph),
    twitterCards: Boolean(parsed.twitterCards),
    schemaMarkup: Boolean(parsed.schemaMarkup)
  }
}

function parseJsonObject(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown

    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<string, unknown>
    }
  } catch {}

  return null
}

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number
) {
  const words = safeText(text).split(" ")
  const lines: string[] = []
  let currentLine = ""

  for (const word of words) {
    const candidate =
      currentLine.length > 0
        ? `${currentLine} ${word}`
        : word

    if (
      font.widthOfTextAtSize(candidate, size) <=
      maxWidth
    ) {
      currentLine = candidate
      continue
    }

    if (currentLine) {
      lines.push(currentLine)
    }

    currentLine = word
  }

  if (currentLine) {
    lines.push(currentLine)
  }

  return lines
}

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  options: {
    font: PDFFont
    size: number
    color?: ReturnType<typeof rgb>
    maxWidth?: number
    lineHeight?: number
    maxLines?: number
  }
) {
  const {
    font,
    size,
    color = theme.text,
    maxWidth,
    lineHeight = size + 5,
    maxLines
  } = options

  const lines = maxWidth
    ? wrapText(text, font, size, maxWidth)
    : [safeText(text)]

  const visibleLines = maxLines
    ? lines.slice(0, maxLines)
    : lines

  visibleLines.forEach((line, index) => {
    const suffix =
      maxLines &&
      index === maxLines - 1 &&
      lines.length > maxLines
        ? "..."
        : ""

    page.drawText(`${line}${suffix}`, {
      x,
      y: y - index * lineHeight,
      size,
      font,
      color
    })
  })

  return visibleLines.length * lineHeight
}

function drawPageBackground(
  page: PDFPage,
  fonts: ReportFonts,
  pageNumber: number
) {
  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    color: theme.background
  })

  page.drawText("AI Marketing OS", {
    x: margin,
    y: 24,
    size: 9,
    font: fonts.bold,
    color: theme.muted
  })

  page.drawText(`Page ${pageNumber}`, {
    x: pageWidth - margin - 40,
    y: 24,
    size: 9,
    font: fonts.regular,
    color: theme.muted
  })
}

function addPage(
  pdfDoc: PDFDocument,
  fonts: ReportFonts
) {
  const page = pdfDoc.addPage([
    pageWidth,
    pageHeight
  ])

  drawPageBackground(
    page,
    fonts,
    pdfDoc.getPageCount()
  )

  return page
}

function ensureSpace(
  pdfDoc: PDFDocument,
  fonts: ReportFonts,
  cursor: Cursor,
  requiredHeight: number
) {
  if (cursor.y - requiredHeight >= 58) {
    return cursor
  }

  return {
    page: addPage(pdfDoc, fonts),
    y: pageHeight - margin
  }
}

function drawSectionTitle(
  pdfDoc: PDFDocument,
  fonts: ReportFonts,
  cursor: Cursor,
  title: string,
  subtitle?: string
) {
  const nextCursor =
    ensureSpace(pdfDoc, fonts, cursor, 58)

  nextCursor.page.drawText(title, {
    x: margin,
    y: nextCursor.y,
    size: 17,
    font: fonts.bold,
    color: theme.text
  })

  nextCursor.page.drawRectangle({
    x: margin,
    y: nextCursor.y - 9,
    width: 42,
    height: 2,
    color: theme.accent
  })

  let consumed = 32

  if (subtitle) {
    consumed += drawText(
      nextCursor.page,
      subtitle,
      margin,
      nextCursor.y - 23,
      {
        font: fonts.regular,
        size: 9,
        color: theme.muted,
        maxWidth: contentWidth
      }
    )
  }

  return {
    page: nextCursor.page,
    y: nextCursor.y - consumed
  }
}

function drawCard(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number
) {
  page.drawRectangle({
    x,
    y: y - height,
    width,
    height,
    color: theme.panel,
    borderColor: theme.border,
    borderWidth: 1
  })
}

function drawSummaryCard(
  page: PDFPage,
  fonts: ReportFonts,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
  accentColor: ReturnType<typeof rgb>
) {
  const height = 86

  drawCard(
    page,
    x,
    y,
    width,
    height
  )

  page.drawRectangle({
    x,
    y: y - 4,
    width,
    height: 4,
    color: accentColor
  })

  page.drawText(label, {
    x: x + 16,
    y: y - 26,
    size: 9,
    font: fonts.regular,
    color: theme.muted
  })

  page.drawText(value, {
    x: x + 16,
    y: y - 58,
    size: 24,
    font: fonts.bold,
    color: theme.text
  })
}

function drawScoreGauge(
  page: PDFPage,
  fonts: ReportFonts,
  score: number,
  x: number,
  y: number,
  width: number
) {
  const clampedScore = Math.max(
    0,
    Math.min(100, score)
  )

  page.drawRectangle({
    x,
    y,
    width,
    height: 10,
    color: theme.panelMuted
  })

  page.drawRectangle({
    x,
    y,
    width: (width * clampedScore) / 100,
    height: 10,
    color: scoreColor(clampedScore)
  })

  page.drawText(`${clampedScore}/100`, {
    x,
    y: y + 20,
    size: 34,
    font: fonts.bold,
    color: scoreColor(clampedScore)
  })

  page.drawText(scoreLabel(clampedScore), {
    x: x + 140,
    y: y + 31,
    size: 13,
    font: fonts.bold,
    color: theme.text
  })
}

function getIssueCounts(
  pages: CrawledPageReportRow[]
) {
  const counts = new Map<string, number>()

  for (const page of pages) {
    for (const issue of parseIssues(page.issues)) {
      counts.set(
        issue,
        (counts.get(issue) || 0) + 1
      )
    }
  }

  return [...counts.entries()]
    .map(([issue, count]) => ({
      issue,
      count
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
}

function getBestPage(
  pages: CrawledPageReportRow[]
) {
  return [...pages].sort(
    (a, b) => b.seo_score - a.seo_score
  )[0]
}

function getWorstPage(
  pages: CrawledPageReportRow[]
) {
  return [...pages].sort(
    (a, b) => a.seo_score - b.seo_score
  )[0]
}

function drawIssueList(
  pdfDoc: PDFDocument,
  fonts: ReportFonts,
  cursor: Cursor,
  issues: IssueCount[]
) {
  let nextCursor =
    ensureSpace(pdfDoc, fonts, cursor, 86)

  if (issues.length === 0) {
    drawCard(
      nextCursor.page,
      margin,
      nextCursor.y,
      contentWidth,
      54
    )

    nextCursor.page.drawText(
      "No recurring issues were detected across crawled pages.",
      {
        x: margin + 16,
        y: nextCursor.y - 32,
        size: 11,
        font: fonts.regular,
        color: theme.success
      }
    )

    return {
      page: nextCursor.page,
      y: nextCursor.y - 72
    }
  }

  for (const issue of issues) {
    nextCursor = ensureSpace(
      pdfDoc,
      fonts,
      nextCursor,
      46
    )

    drawCard(
      nextCursor.page,
      margin,
      nextCursor.y,
      contentWidth,
      38
    )

    nextCursor.page.drawText(
      `${issue.count}x`,
      {
        x: margin + 14,
        y: nextCursor.y - 24,
        size: 12,
        font: fonts.bold,
        color: theme.danger
      }
    )

    drawText(
      nextCursor.page,
      issue.issue,
      margin + 58,
      nextCursor.y - 24,
      {
        font: fonts.regular,
        size: 10,
        color: theme.text,
        maxWidth: contentWidth - 78,
        maxLines: 1
      }
    )

    nextCursor = {
      page: nextCursor.page,
      y: nextCursor.y - 46
    }
  }

  return nextCursor
}

function drawTechnicalSeo(
  pdfDoc: PDFDocument,
  fonts: ReportFonts,
  cursor: Cursor,
  technicalSeo: TechnicalSeoResult | null
) {
  const labels: Array<{
    key: keyof TechnicalSeoResult
    label: string
  }> = [
    {
      key: "robotsTxt",
      label: "robots.txt"
    },
    {
      key: "sitemap",
      label: "XML sitemap"
    },
    {
      key: "canonical",
      label: "Canonical tag"
    },
    {
      key: "openGraph",
      label: "Open Graph"
    },
    {
      key: "twitterCards",
      label: "Twitter cards"
    },
    {
      key: "schemaMarkup",
      label: "Schema markup"
    }
  ]

  const nextCursor =
    ensureSpace(pdfDoc, fonts, cursor, 120)

  if (!technicalSeo) {
    drawCard(
      nextCursor.page,
      margin,
      nextCursor.y,
      contentWidth,
      62
    )

    drawText(
      nextCursor.page,
      "Technical SEO results were not stored for this historical audit. New audits can persist this field without changing the report API.",
      margin + 16,
      nextCursor.y - 26,
      {
        font: fonts.regular,
        size: 10,
        color: theme.muted,
        maxWidth: contentWidth - 32,
        lineHeight: 14
      }
    )

    return {
      page: nextCursor.page,
      y: nextCursor.y - 82
    }
  }

  const itemWidth = (contentWidth - 24) / 3
  const itemHeight = 46

  labels.forEach((item, index) => {
    const row = Math.floor(index / 3)
    const column = index % 3
    const x = margin + column * (itemWidth + 12)
    const y = nextCursor.y - row * 58
    const passed = technicalSeo[item.key]

    drawCard(
      nextCursor.page,
      x,
      y,
      itemWidth,
      itemHeight
    )

    nextCursor.page.drawText(
      passed ? "PASS" : "MISSING",
      {
        x: x + 14,
        y: y - 20,
        size: 8,
        font: fonts.bold,
        color: passed
          ? theme.success
          : theme.danger
      }
    )

    nextCursor.page.drawText(item.label, {
      x: x + 14,
      y: y - 35,
      size: 10,
      font: fonts.regular,
      color: theme.text
    })
  })

  return {
    page: nextCursor.page,
    y: nextCursor.y - 126
  }
}

function drawBestWorstPages(
  pdfDoc: PDFDocument,
  fonts: ReportFonts,
  cursor: Cursor,
  bestPage: CrawledPageReportRow | undefined,
  worstPage: CrawledPageReportRow | undefined
) {
  const nextCursor =
    ensureSpace(pdfDoc, fonts, cursor, 112)

  const cardWidth = (contentWidth - 16) / 2
  const rows = [
    {
      title: "Best performing page",
      page: bestPage,
      color: theme.success,
      x: margin
    },
    {
      title: "Highest priority page",
      page: worstPage,
      color: theme.danger,
      x: margin + cardWidth + 16
    }
  ]

  for (const row of rows) {
    drawCard(
      nextCursor.page,
      row.x,
      nextCursor.y,
      cardWidth,
      102
    )

    nextCursor.page.drawText(row.title, {
      x: row.x + 16,
      y: nextCursor.y - 24,
      size: 10,
      font: fonts.bold,
      color: row.color
    })

    nextCursor.page.drawText(
      `${row.page?.seo_score ?? 0}/100`,
      {
        x: row.x + 16,
        y: nextCursor.y - 52,
        size: 20,
        font: fonts.bold,
        color: theme.text
      }
    )

    drawText(
      nextCursor.page,
      row.page?.url || "No crawled page available",
      row.x + 16,
      nextCursor.y - 74,
      {
        font: fonts.regular,
        size: 9,
        color: theme.muted,
        maxWidth: cardWidth - 32,
        lineHeight: 12,
        maxLines: 2
      }
    )
  }

  return {
    page: nextCursor.page,
    y: nextCursor.y - 122
  }
}

function drawScoreChart(
  pdfDoc: PDFDocument,
  fonts: ReportFonts,
  cursor: Cursor,
  pages: CrawledPageReportRow[]
) {
  const chartPages = [...pages]
    .sort((a, b) => b.seo_score - a.seo_score)
    .slice(0, 6)

  const nextCursor =
    ensureSpace(pdfDoc, fonts, cursor, 180)

  drawCard(
    nextCursor.page,
    margin,
    nextCursor.y,
    contentWidth,
    162
  )

  if (chartPages.length === 0) {
    nextCursor.page.drawText(
      "No crawled page score data is available for charting.",
      {
        x: margin + 16,
        y: nextCursor.y - 36,
        size: 10,
        font: fonts.regular,
        color: theme.muted
      }
    )

    return {
      page: nextCursor.page,
      y: nextCursor.y - 184
    }
  }

  const barAreaX = margin + 160
  const barWidth = contentWidth - 206
  let barY = nextCursor.y - 34

  chartPages.forEach((pageRow, index) => {
    const score = Math.max(
      0,
      Math.min(100, pageRow.seo_score)
    )
    const label = `Page ${index + 1}`

    nextCursor.page.drawText(label, {
      x: margin + 16,
      y: barY,
      size: 9,
      font: fonts.bold,
      color: theme.text
    })

    drawText(
      nextCursor.page,
      pageRow.url,
      margin + 16,
      barY - 13,
      {
        font: fonts.regular,
        size: 7,
        color: theme.muted,
        maxWidth: 126,
        maxLines: 1
      }
    )

    nextCursor.page.drawRectangle({
      x: barAreaX,
      y: barY - 1,
      width: barWidth,
      height: 9,
      color: theme.panelMuted
    })

    nextCursor.page.drawRectangle({
      x: barAreaX,
      y: barY - 1,
      width: (barWidth * score) / 100,
      height: 9,
      color: scoreColor(score)
    })

    nextCursor.page.drawText(String(score), {
      x: barAreaX + barWidth + 10,
      y: barY - 1,
      size: 9,
      font: fonts.bold,
      color: theme.text
    })

    barY -= 22
  })

  return {
    page: nextCursor.page,
    y: nextCursor.y - 184
  }
}

function drawRecommendations(
  pdfDoc: PDFDocument,
  fonts: ReportFonts,
  cursor: Cursor,
  pages: CrawledPageReportRow[]
) {
  const recommendations = pages
    .map((page) => ({
      url: page.url,
      text:
        page.ai_recommendations ||
        "No recommendation stored for this page."
    }))
    .slice(0, 5)

  let nextCursor =
    ensureSpace(pdfDoc, fonts, cursor, 84)

  if (recommendations.length === 0) {
    drawCard(
      nextCursor.page,
      margin,
      nextCursor.y,
      contentWidth,
      54
    )

    nextCursor.page.drawText(
      "No AI recommendations are available for this audit.",
      {
        x: margin + 16,
        y: nextCursor.y - 32,
        size: 10,
        font: fonts.regular,
        color: theme.muted
      }
    )

    return {
      page: nextCursor.page,
      y: nextCursor.y - 74
    }
  }

  for (const recommendation of recommendations) {
    nextCursor = ensureSpace(
      pdfDoc,
      fonts,
      nextCursor,
      98
    )

    drawCard(
      nextCursor.page,
      margin,
      nextCursor.y,
      contentWidth,
      84
    )

    drawText(
      nextCursor.page,
      recommendation.url,
      margin + 16,
      nextCursor.y - 23,
      {
        font: fonts.bold,
        size: 9,
        color: theme.accent,
        maxWidth: contentWidth - 32,
        maxLines: 1
      }
    )

    drawText(
      nextCursor.page,
      recommendation.text,
      margin + 16,
      nextCursor.y - 43,
      {
        font: fonts.regular,
        size: 9,
        color: theme.text,
        maxWidth: contentWidth - 32,
        lineHeight: 12,
        maxLines: 3
      }
    )

    nextCursor = {
      page: nextCursor.page,
      y: nextCursor.y - 98
    }
  }

  return nextCursor
}

export async function generatePDFReport(
  audit: AuditReportRow,
  pages: CrawledPageReportRow[]
) {
  const pdfDoc =
    await PDFDocument.create()

  pdfDoc.setTitle(
    `SEO Audit Report - ${safeText(audit.url)}`
  )
  pdfDoc.setAuthor("AI Marketing OS")
  pdfDoc.setSubject("Professional SEO audit report")
  pdfDoc.setCreationDate(new Date())

  const fonts: ReportFonts = {
    regular: await pdfDoc.embedFont(
      StandardFonts.Helvetica
    ),
    bold: await pdfDoc.embedFont(
      StandardFonts.HelveticaBold
    )
  }

  let cursor: Cursor = {
    page: addPage(pdfDoc, fonts),
    y: pageHeight - margin
  }

  cursor.page.drawText("Professional SEO Audit", {
    x: margin,
    y: cursor.y,
    size: 30,
    font: fonts.bold,
    color: theme.text
  })

  cursor.page.drawText("AI Marketing OS", {
    x: margin,
    y: cursor.y - 28,
    size: 12,
    font: fonts.bold,
    color: theme.accent
  })

  drawText(
    cursor.page,
    audit.url,
    margin,
    cursor.y - 58,
    {
      font: fonts.regular,
      size: 12,
      color: theme.muted,
      maxWidth: 520,
      maxLines: 2
    }
  )

  cursor.page.drawText(
    `Audit timestamp: ${formatAuditDate(audit.created_at)}`,
    {
      x: margin,
      y: cursor.y - 92,
      size: 10,
      font: fonts.regular,
      color: theme.muted
    }
  )

  drawScoreGauge(
    cursor.page,
    fonts,
    audit.average_score,
    margin,
    cursor.y - 152,
    300
  )

  const summaryCardWidth =
    (contentWidth - 36) / 3

  drawSummaryCard(
    cursor.page,
    fonts,
    margin,
    cursor.y - 214,
    summaryCardWidth,
    "Average score",
    `${audit.average_score}/100`,
    scoreColor(audit.average_score)
  )

  drawSummaryCard(
    cursor.page,
    fonts,
    margin + summaryCardWidth + 18,
    cursor.y - 214,
    summaryCardWidth,
    "Pages crawled",
    String(audit.total_pages),
    theme.accent
  )

  drawSummaryCard(
    cursor.page,
    fonts,
    margin + summaryCardWidth * 2 + 36,
    cursor.y - 214,
    summaryCardWidth,
    "Open issues",
    String(audit.total_issues),
    audit.total_issues > 0
      ? theme.danger
      : theme.success
  )

  cursor = {
    page: cursor.page,
    y: cursor.y - 330
  }

  cursor = drawSectionTitle(
    pdfDoc,
    fonts,
    cursor,
    "Executive Summary",
    "High-level performance and priority indicators for this crawl."
  )

  cursor = drawBestWorstPages(
    pdfDoc,
    fonts,
    cursor,
    getBestPage(pages),
    getWorstPage(pages)
  )

  cursor = drawSectionTitle(
    pdfDoc,
    fonts,
    cursor,
    "Technical SEO",
    "Infrastructure and metadata checks captured with the audit where available."
  )

  cursor = drawTechnicalSeo(
    pdfDoc,
    fonts,
    cursor,
    parseTechnicalSeo(audit.technical_seo)
  )

  cursor = drawSectionTitle(
    pdfDoc,
    fonts,
    cursor,
    "Top SEO Issues",
    "Most frequent SEO issues found across crawled pages."
  )

  cursor = drawIssueList(
    pdfDoc,
    fonts,
    cursor,
    getIssueCounts(pages)
  )

  cursor = drawSectionTitle(
    pdfDoc,
    fonts,
    cursor,
    "Page Score Chart",
    "Lightweight vector chart of the strongest crawled page scores."
  )

  cursor = drawScoreChart(
    pdfDoc,
    fonts,
    cursor,
    pages
  )

  cursor = drawSectionTitle(
    pdfDoc,
    fonts,
    cursor,
    "AI Recommendations",
    "Prioritized recommendations generated during the audit."
  )

  drawRecommendations(
    pdfDoc,
    fonts,
    cursor,
    pages
  )

  return pdfDoc.save()
}
