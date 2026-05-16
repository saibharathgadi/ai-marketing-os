import type { RegressionAnalysis } from "./seoRegression"

type EmailAuditRow = {
  id?: string
  url: string
  average_score: number
  total_pages: number
  total_issues: number
  created_at?: string | null
}

type EmailPageRow = {
  url: string
  seo_score: number
  word_count: number
  issues?: string[] | string | null
  ai_recommendations?: string | null
}

type SendSeoReportEmailInput = {
  to: string
  audit: EmailAuditRow
  pages: EmailPageRow[]
  pdfBytes: Uint8Array
  reportId: string
}

type SendSeoRegressionAlertEmailInput = {
  to: string
  audit: EmailAuditRow
  regression: RegressionAnalysis
}

type ResendSuccessResponse = {
  id?: string
}

type SendSeoReportEmailResult = {
  success: boolean
  emailId?: string
  error?: string
}

const resendApiUrl = "https://api.resend.com/emails"
const defaultFromEmail =
  "AI Marketing OS <onboarding@resend.dev>"

function getFromEmail() {
  return (
    process.env.RESEND_FROM_EMAIL ||
    defaultFromEmail
  )
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email
  )
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function cleanText(value: string) {
  return value
    .replace(/\s+/g, " ")
    .trim()
}

function parseIssues(
  issues: string[] | string | null | undefined
) {
  if (Array.isArray(issues)) {
    return issues
      .map(cleanText)
      .filter(Boolean)
  }

  if (!issues) {
    return []
  }

  try {
    const parsed = JSON.parse(issues) as unknown

    if (Array.isArray(parsed)) {
      return parsed
        .map((issue) =>
          cleanText(String(issue))
        )
        .filter(Boolean)
    }
  } catch {}

  return issues
    .split(",")
    .map(cleanText)
    .filter(Boolean)
}

function getTopRecommendations(
  pages: EmailPageRow[]
) {
  const recommendations = pages
    .flatMap((page) =>
      (page.ai_recommendations || "")
        .split(/\n{2,}|\n|\. /)
        .map((recommendation) =>
          cleanText(recommendation)
        )
        .filter(Boolean)
    )
    .filter(
      (recommendation, index, all) =>
        all.indexOf(recommendation) === index
    )
    .slice(0, 5)

  if (recommendations.length > 0) {
    return recommendations
  }

  const issues = pages
    .flatMap((page) =>
      parseIssues(page.issues)
    )
    .filter(
      (issue, index, all) =>
        all.indexOf(issue) === index
    )
    .slice(0, 5)

  if (issues.length > 0) {
    return issues.map(
      (issue) => `Resolve: ${issue}`
    )
  }

  return [
    "No urgent recommendations were found for this audit."
  ]
}

function getScoreLabel(score: number) {
  if (score >= 80) {
    return "Strong"
  }

  if (score >= 55) {
    return "Needs attention"
  }

  return "High priority"
}

function buildReportHtml(
  audit: EmailAuditRow,
  recommendations: string[]
) {
  const scoreLabel =
    getScoreLabel(audit.average_score)

  const recommendationItems =
    recommendations
      .map(
        (recommendation) =>
          `<li style="margin:0 0 10px 0;color:#d4d4d8;line-height:1.5;">${escapeHtml(
            recommendation
          )}</li>`
      )
      .join("")

  return `<!doctype html>
<html>
  <body style="margin:0;background:#09090b;color:#fafafa;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;background:#111217;border:1px solid #2f333d;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 18px 32px;border-bottom:1px solid #2f333d;">
                <div style="font-size:13px;font-weight:700;color:#60a5fa;letter-spacing:0.04em;text-transform:uppercase;">AI Marketing OS</div>
                <h1 style="margin:12px 0 10px 0;color:#ffffff;font-size:28px;line-height:1.2;">SEO Audit Report</h1>
                <p style="margin:0;color:#a1a1aa;font-size:14px;line-height:1.6;">${escapeHtml(
                  audit.url
                )}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width:33.333%;padding:14px;background:#181a20;border:1px solid #2f333d;">
                      <div style="font-size:12px;color:#a1a1aa;">SEO Score</div>
                      <div style="margin-top:8px;font-size:26px;font-weight:700;color:#ffffff;">${audit.average_score}/100</div>
                      <div style="margin-top:4px;font-size:12px;color:#60a5fa;">${escapeHtml(
                        scoreLabel
                      )}</div>
                    </td>
                    <td style="width:33.333%;padding:14px;background:#181a20;border:1px solid #2f333d;">
                      <div style="font-size:12px;color:#a1a1aa;">Pages Crawled</div>
                      <div style="margin-top:8px;font-size:26px;font-weight:700;color:#ffffff;">${audit.total_pages}</div>
                    </td>
                    <td style="width:33.333%;padding:14px;background:#181a20;border:1px solid #2f333d;">
                      <div style="font-size:12px;color:#a1a1aa;">Total Issues</div>
                      <div style="margin-top:8px;font-size:26px;font-weight:700;color:#ffffff;">${audit.total_issues}</div>
                    </td>
                  </tr>
                </table>
                <h2 style="margin:28px 0 12px 0;color:#ffffff;font-size:18px;">Top Recommendations</h2>
                <ul style="margin:0;padding-left:20px;">
                  ${recommendationItems}
                </ul>
                <p style="margin:28px 0 0 0;color:#a1a1aa;font-size:13px;line-height:1.6;">The full professional PDF report is attached to this email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function buildReportText(
  audit: EmailAuditRow,
  recommendations: string[]
) {
  return [
    "AI Marketing OS - SEO Audit Report",
    "",
    `Website: ${audit.url}`,
    `SEO Score: ${audit.average_score}/100`,
    `Pages Crawled: ${audit.total_pages}`,
    `Total Issues: ${audit.total_issues}`,
    "",
    "Top Recommendations:",
    ...recommendations.map(
      (recommendation) =>
        `- ${recommendation}`
    ),
    "",
    "The full professional PDF report is attached."
  ].join("\n")
}

function buildRegressionAlertHtml(
  audit: EmailAuditRow,
  regression: RegressionAnalysis
) {
  const alertItems =
    regression.alerts
      .map(
        (alert) =>
          `<li style="margin:0 0 10px 0;color:#d4d4d8;line-height:1.5;">${escapeHtml(
            alert.message
          )}</li>`
      )
      .join("")

  return `<!doctype html>
<html>
  <body style="margin:0;background:#09090b;color:#fafafa;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;background:#111217;border:1px solid #2f333d;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:32px;border-bottom:1px solid #2f333d;">
                <div style="font-size:13px;font-weight:700;color:#60a5fa;letter-spacing:0.04em;text-transform:uppercase;">AI Marketing OS</div>
                <h1 style="margin:12px 0 10px 0;color:#ffffff;font-size:28px;line-height:1.2;">SEO Regression Alert</h1>
                <p style="margin:0;color:#a1a1aa;font-size:14px;line-height:1.6;">${escapeHtml(
                  audit.url
                )}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width:33.333%;padding:14px;background:#181a20;border:1px solid #2f333d;">
                      <div style="font-size:12px;color:#a1a1aa;">Health</div>
                      <div style="margin-top:8px;font-size:22px;font-weight:700;color:#ffffff;">${escapeHtml(
                        regression.status
                      )}</div>
                    </td>
                    <td style="width:33.333%;padding:14px;background:#181a20;border:1px solid #2f333d;">
                      <div style="font-size:12px;color:#a1a1aa;">SEO Score</div>
                      <div style="margin-top:8px;font-size:22px;font-weight:700;color:#ffffff;">${audit.average_score}/100</div>
                    </td>
                    <td style="width:33.333%;padding:14px;background:#181a20;border:1px solid #2f333d;">
                      <div style="font-size:12px;color:#a1a1aa;">Total Issues</div>
                      <div style="margin-top:8px;font-size:22px;font-weight:700;color:#ffffff;">${audit.total_issues}</div>
                    </td>
                  </tr>
                </table>
                <p style="margin:24px 0 0 0;color:#d4d4d8;font-size:14px;line-height:1.6;">${escapeHtml(
                  regression.summary
                )}</p>
                <h2 style="margin:28px 0 12px 0;color:#ffffff;font-size:18px;">Detected Changes</h2>
                <ul style="margin:0;padding-left:20px;">
                  ${alertItems}
                </ul>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function buildRegressionAlertText(
  audit: EmailAuditRow,
  regression: RegressionAnalysis
) {
  return [
    "AI Marketing OS - SEO Regression Alert",
    "",
    `Website: ${audit.url}`,
    `Health: ${regression.status}`,
    `SEO Score: ${audit.average_score}/100`,
    `Pages Crawled: ${audit.total_pages}`,
    `Total Issues: ${audit.total_issues}`,
    "",
    regression.summary,
    "",
    "Detected Changes:",
    ...regression.alerts.map(
      (alert) => `- ${alert.message}`
    )
  ].join("\n")
}

function getPdfBase64(pdfBytes: Uint8Array) {
  return Buffer.from(pdfBytes).toString("base64")
}

export function validateReportRecipient(
  to: string
) {
  return isValidEmail(to)
}

export async function sendSeoReportEmail({
  to,
  audit,
  pages,
  pdfBytes,
  reportId
}: SendSeoReportEmailInput): Promise<SendSeoReportEmailResult> {
  if (!validateReportRecipient(to)) {
    return {
      success: false,
      error: "A valid recipient email is required."
    }
  }

  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    return {
      success: false,
      error:
        "RESEND_API_KEY is not configured."
    }
  }

  const recommendations =
    getTopRecommendations(pages)

  const payload = {
    from: getFromEmail(),
    to: [to],
    subject: `SEO Audit Report: ${audit.url}`,
    html: buildReportHtml(
      audit,
      recommendations
    ),
    text: buildReportText(
      audit,
      recommendations
    ),
    attachments: [
      {
        filename: `seo-report-${reportId}.pdf`,
        content: getPdfBase64(pdfBytes),
        content_type: "application/pdf"
      }
    ],
    tags: [
      {
        name: "category",
        value: "seo-report"
      }
    ]
  }

  try {
    const response = await fetch(resendApiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    })

    const result =
      (await response.json().catch(() => null)) as
        | ResendSuccessResponse
        | { message?: string }
        | null

    if (!response.ok) {
      const message =
        result &&
        "message" in result &&
        result.message
          ? result.message
          : "Failed to send report email."

      return {
        success: false,
        error: message
      }
    }

    return {
      success: true,
      emailId:
        result &&
        "id" in result
          ? result.id
          : undefined
    }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to send report email."
    }
  }
}

export async function sendSeoRegressionAlertEmail({
  to,
  audit,
  regression
}: SendSeoRegressionAlertEmailInput): Promise<SendSeoReportEmailResult> {
  if (!validateReportRecipient(to)) {
    return {
      success: false,
      error: "A valid recipient email is required."
    }
  }

  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    return {
      success: false,
      error:
        "RESEND_API_KEY is not configured."
    }
  }

  try {
    const response = await fetch(resendApiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: getFromEmail(),
        to: [to],
        subject:
          `SEO ${regression.status} Alert: ${audit.url}`,
        html: buildRegressionAlertHtml(
          audit,
          regression
        ),
        text: buildRegressionAlertText(
          audit,
          regression
        ),
        tags: [
          {
            name: "category",
            value: "seo-regression-alert"
          }
        ]
      })
    })

    const result =
      (await response.json().catch(() => null)) as
        | ResendSuccessResponse
        | { message?: string }
        | null

    if (!response.ok) {
      const message =
        result &&
        "message" in result &&
        result.message
          ? result.message
          : "Failed to send regression alert email."

      return {
        success: false,
        error: message
      }
    }

    return {
      success: true,
      emailId:
        result &&
        "id" in result
          ? result.id
          : undefined
    }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to send regression alert email."
    }
  }
}
