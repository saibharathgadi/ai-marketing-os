import { PDFDocument, rgb, StandardFonts } from "pdf-lib"

type AuditReportRow = {
  url: string
  average_score: number
  total_pages: number
  total_issues: number
}

type CrawledPageReportRow = {
  url: string
  seo_score: number
  word_count: number
  issues?: string[] | null
}

export async function generatePDFReport(
  audit: AuditReportRow,
  pages: CrawledPageReportRow[]
) {

  const pdfDoc =
    await PDFDocument.create()

  const page =
    pdfDoc.addPage([800, 1200])

  const font =
    await pdfDoc.embedFont(
      StandardFonts.Helvetica
    )

  let y = 1150

  page.drawText(
    "AI Marketing OS - SEO Audit Report",
    {
      x: 50,
      y,
      size: 24,
      font,
      color: rgb(1, 1, 1)
    }
  )

  y -= 50

  page.drawText(
    `Website: ${audit.url}`,
    {
      x: 50,
      y,
      size: 14,
      font
    }
  )

  y -= 30

  page.drawText(
    `Average SEO Score: ${audit.average_score}`,
    {
      x: 50,
      y,
      size: 14,
      font
    }
  )

  y -= 30

  page.drawText(
    `Pages Crawled: ${audit.total_pages}`,
    {
      x: 50,
      y,
      size: 14,
      font
    }
  )

  y -= 30

  page.drawText(
    `Total Issues: ${audit.total_issues}`,
    {
      x: 50,
      y,
      size: 14,
      font
    }
  )

  y -= 60

  for (const crawledPage of pages) {

    if (y < 120) {
      break
    }

    page.drawText(
      `URL: ${crawledPage.url}`,
      {
        x: 50,
        y,
        size: 12,
        font
      }
    )

    y -= 20

    page.drawText(
      `SEO Score: ${crawledPage.seo_score}`,
      {
        x: 50,
        y,
        size: 12,
        font
      }
    )

    y -= 20

    page.drawText(
      `Word Count: ${crawledPage.word_count}`,
      {
        x: 50,
        y,
        size: 12,
        font
      }
    )

    y -= 20

    page.drawText(
      `Issues: ${
        crawledPage.issues?.join(", ") ||
        "None"
      }`,
      {
        x: 50,
        y,
        size: 10,
        font
      }
    )

    y -= 40

  }

  const pdfBytes =
    await pdfDoc.save()

  return pdfBytes

}
