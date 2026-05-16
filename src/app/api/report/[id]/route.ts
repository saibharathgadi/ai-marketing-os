import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { generatePDFReport } from "@/utils/pdfReport"

export async function GET(
  _request: Request,
  context: {
    params: Promise<{ id: string }>
  }
) {

  const { id } =
    await context.params

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
      .select("*")
      .eq("audit_id", id)
      .order("seo_score", {
        ascending: false
      })

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
