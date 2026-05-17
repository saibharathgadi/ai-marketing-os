import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { generatePDFReport } from "@/utils/pdfReport"
import {
  sendSeoReportEmail,
  validateReportRecipient
} from "@/utils/emailReport"
import {
  checkRateLimit,
  getRequestKey
} from "@/utils/rateLimit"

type EmailRequestBody = {
  to?: string
}

export async function POST(
  request: Request,
  context: {
    params: Promise<{ id: string }>
  }
) {

  const rateLimit =
    checkRateLimit({
      key: getRequestKey(
        request,
        "email-report"
      ),
      limit: 5,
      windowMs: 60_000
    })

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Too many email requests. Please try again shortly.",
        retryAfterSeconds:
          rateLimit.retryAfterSeconds
      },
      {
        status: 429,
        headers: {
          "Retry-After":
            String(
              rateLimit.retryAfterSeconds
            )
        }
      }
    )
  }

  const { id } =
    await context.params

  let body: EmailRequestBody

  try {
    body =
      (await request.json()) as EmailRequestBody
  } catch {
    return NextResponse.json(
      {
        success: false,
        error:
          "Request body must be valid JSON."
      },
      {
        status: 400
      }
    )
  }

  const recipient =
    body.to?.trim() || ""

  if (!validateReportRecipient(recipient)) {
    return NextResponse.json(
      {
        success: false,
        error:
          "A valid recipient email is required."
      },
      {
        status: 400
      }
    )
  }

  const { data: audit } =
    await supabase
      .from("audits")
      .select("*")
      .eq("id", id)
      .single()

  if (!audit) {

    return NextResponse.json(
      {
        success: false,
        error: "Audit not found"
      },
      {
        status: 404
      }
    )

  }

  const { data: pages, error: pagesError } =
    await supabase
      .from("crawled_pages")
      .select(
        "id,audit_id,url,title,meta_description,h1s,h2s,seo_score,word_count,issues,ai_recommendations"
      )
      .eq("audit_id", id)
      .order("seo_score", {
        ascending: false
      })
      .limit(25)

  if (pagesError) {

    console.error(
      "Failed to fetch crawled pages for report email:",
      pagesError
    )

    return NextResponse.json(
      {
        success: false,
        error:
          "Failed to load report page data."
      },
      {
        status: 500
      }
    )

  }

  const pdfBytes =
    await generatePDFReport(
      audit,
      pages || []
    )

  const emailResult =
    await sendSeoReportEmail({
      to: recipient,
      audit,
      pages: pages || [],
      pdfBytes,
      reportId: id
    })

  if (!emailResult.success) {

    console.error(
      "Failed to send report email:",
      emailResult.error
    )

    return NextResponse.json(
      {
        success: false,
        error:
          emailResult.error ||
          "Failed to send report email."
      },
      {
        status: 502
      }
    )

  }

  return NextResponse.json({
    success: true,
    emailId:
      emailResult.emailId,
    message:
      "SEO report email sent successfully."
  })

}
