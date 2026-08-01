import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generatePDFReport } from "@/utils/pdfReport"

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
      "Failed to fetch audit for report:",
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
      "Failed to fetch crawled pages for report:",
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

  const pdfBytes =
    await generatePDFReport(
      audit,
      pages || []
    )

  const pdfBody =
    pdfBytes.buffer.slice(
      pdfBytes.byteOffset,
      pdfBytes.byteOffset + pdfBytes.byteLength
    ) as ArrayBuffer

  return new NextResponse(pdfBody, {
    headers: {
      "Content-Type":
        "application/pdf",

      "Content-Disposition":
        `attachment; filename="seo-report-${id}.pdf"`,

      "Content-Length":
        String(pdfBody.byteLength),

      "Cache-Control":
        "private, no-store, max-age=0"
    }
  })

}
