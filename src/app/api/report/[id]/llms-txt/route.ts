import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateLlmsTxt } from "@/utils/llmsTxtReport"

export async function GET(
  _request: Request,
  context: {
    params: Promise<{ id: string }>
  }
) {

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
      .select("*")
      .eq("id", id)
      .single()

  if (auditError && auditError.code !== "PGRST116") {

    console.error(
      "Failed to fetch audit for llms.txt:",
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

  const { data: pages, error: pagesError } =
    await supabase
      .from("crawled_pages")
      .select("id,audit_id,url,title,meta_description")
      .eq("audit_id", id)
      .order("seo_score", {
        ascending: false
      })
      .limit(25)

  if (pagesError) {

    console.error(
      "Failed to fetch crawled pages for llms.txt:",
      pagesError
    )

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load report page data"
      },
      {
        status: 500
      }
    )

  }

  const llmsTxt =
    generateLlmsTxt(
      audit,
      pages || []
    )

  return new NextResponse(llmsTxt, {
    headers: {
      "Content-Type":
        "text/plain; charset=utf-8",

      "Content-Disposition":
        `attachment; filename="llms-${id}.txt"`,

      "Cache-Control":
        "private, no-store, max-age=0"
    }
  })

}
