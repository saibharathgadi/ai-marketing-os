import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateFaqSuggestions } from "@/utils/faqSchemaGenerator"
import {
  checkRateLimit,
  getRequestKey
} from "@/utils/rateLimit"

export async function POST(
  request: Request,
  context: {
    params: Promise<{ id: string }>
  }
) {

  const rateLimit =
    await checkRateLimit({
      key: getRequestKey(
        request,
        "audit-faq-schema"
      ),
      limit: 8,
      windowMs: 60_000
    })

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Too many requests. Please try again shortly.",
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

  const supabase = await createClient()

  // RLS restricts this to audits in organizations the current user
  // belongs to — an id from another org resolves to no row, which
  // correctly falls through to the 404 branch below rather than
  // leaking that the audit exists elsewhere.
  const { data: audit, error: auditError } =
    await supabase
      .from("audits")
      .select("id,org_id,url,ai_insights")
      .eq("id", id)
      .single()

  if (auditError && auditError.code !== "PGRST116") {

    console.error(
      "Failed to fetch audit for FAQ schema:",
      auditError
    )

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load audit."
      },
      {
        status: 500
      }
    )

  }

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

  // The anon RLS policy on `audits` deliberately allows selecting
  // teaser (org_id is null) rows so the preview-audit page works while
  // logged out -- but that same policy would let an anonymous caller
  // hit this route directly (bypassing the UI, which never shows this
  // button for a teaser audit) and trigger real AI-provider calls.
  // Rate limiting alone is defense-in-depth, not the security boundary,
  // so block preview audits outright here.
  if (!audit.org_id) {

    return NextResponse.json(
      {
        success: false,
        error: "FAQ schema generation is unavailable for preview audits."
      },
      {
        status: 403
      }
    )

  }

  const aiInsights =
    audit.ai_insights as
      | { executiveSummary?: string; detectedThemes?: string[] }
      | null

  const result =
    await generateFaqSuggestions({
      siteUrl: audit.url,
      executiveSummary: aiInsights?.executiveSummary,
      detectedThemes: aiInsights?.detectedThemes
    })

  return NextResponse.json({
    success: true,
    data: result
  })

}
