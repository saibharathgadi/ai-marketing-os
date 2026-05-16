import Link from "next/link"
import { supabase } from "@/lib/supabase"

export default async function AuditDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {

  const { id } = await params

  const { data: audit } =
    await supabase
      .from("audits")
      .select("*")
      .eq("id", id)
      .single()

  const { data: pages } =
    await supabase
      .from("crawled_pages")
      .select("*")
      .eq("audit_id", id)

  return (

    <main className="min-h-screen bg-black text-white">

      <div className="max-w-7xl mx-auto px-6 py-10">

        <h1 className="text-5xl font-bold">
          Audit Details
        </h1>

        <p className="text-zinc-400 mt-3 break-all">
          {audit?.url}
        </p>

        <div className="flex flex-wrap gap-4 mt-6">

          <Link
            href="/dashboard"
            className="rounded-xl bg-zinc-800 px-5 py-3"
          >
            ← Dashboard
          </Link>

          <Link
            href="/"
            className="rounded-xl bg-zinc-800 px-5 py-3"
          >
            🏠 Home
          </Link>

          <Link
            href={`/api/report/${id}`}
            className="rounded-xl bg-white text-black px-5 py-3 font-semibold"
          >
            Download PDF
          </Link>

        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

            <p className="text-zinc-400 text-sm">
              Average SEO Score
            </p>

            <h2 className="text-5xl font-bold mt-3">
              {audit?.average_score}
            </h2>

          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

            <p className="text-zinc-400 text-sm">
              Pages Crawled
            </p>

            <h2 className="text-5xl font-bold mt-3">
              {audit?.total_pages}
            </h2>

          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

            <p className="text-zinc-400 text-sm">
              Total Issues
            </p>

            <h2 className="text-5xl font-bold mt-3">
              {audit?.total_issues}
            </h2>

          </div>

        </div>

        <div className="mt-10 space-y-8">

          {pages?.map((page) => (

            <div
              key={page.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden"
            >

              <div className="p-6 border-b border-zinc-800">

                <div className="flex items-center justify-between gap-6">

                  <div>

                    <h2 className="text-xl font-semibold break-all">
                      {page.url}
                    </h2>

                    <p className="text-zinc-500 mt-2">
                      {page.title}
                    </p>

                  </div>

                  <div className="text-right">

                    <p className="text-zinc-500 text-sm">
                      SEO Score
                    </p>

                    <h3 className="text-4xl font-bold">
                      {page.seo_score}
                    </h3>

                  </div>

                </div>

              </div>

              <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">

                <div className="space-y-6">

                  <div>

                    <p className="text-sm text-zinc-500 mb-2">
                      Meta Description
                    </p>

                    <div className="rounded-xl bg-zinc-950 p-4 text-zinc-300">
                      {page.meta_description ||
                        "No meta description"}
                    </div>

                  </div>

                  <div>

                    <p className="text-sm text-zinc-500 mb-2">
                      H1 Headings
                    </p>

                    <div className="space-y-2">

                      {page.h1s?.map(
                        (
                          heading: string,
                          index: number
                        ) => (

                          <div
                            key={index}
                            className="rounded-xl bg-zinc-950 p-3"
                          >
                            {heading}
                          </div>

                        )
                      )}

                    </div>

                  </div>

                  <div>

                    <p className="text-sm text-zinc-500 mb-2">
                      H2 Headings
                    </p>

                    <div className="space-y-2">

                      {page.h2s?.map(
                        (
                          heading: string,
                          index: number
                        ) => (

                          <div
                            key={index}
                            className="rounded-xl bg-zinc-950 p-3"
                          >
                            {heading}
                          </div>

                        )
                      )}

                    </div>

                  </div>

                </div>

                <div className="space-y-6">

                  <div>

                    <p className="text-sm text-zinc-500 mb-2">
                      SEO Issues
                    </p>

                    <div className="space-y-2">

                      {page.issues?.length === 0 ? (

                        <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-3 text-green-300">
                          No SEO issues detected
                        </div>

                      ) : (

                        page.issues?.map(
                          (
                            issue: string,
                            index: number
                          ) => (

                            <div
                              key={index}
                              className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-red-300"
                            >
                              {issue}
                            </div>

                          )
                        )

                      )}

                    </div>

                  </div>

                  <div>

                    <p className="text-sm text-zinc-500 mb-2">
                      AI Recommendations
                    </p>

                    <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-4 whitespace-pre-wrap text-blue-100">
                      {page.ai_recommendations}
                    </div>

                  </div>

                  <div>

                    <p className="text-sm text-zinc-500 mb-2">
                      Word Count
                    </p>

                    <div className="rounded-xl bg-zinc-950 p-4">
                      {page.word_count}
                    </div>

                  </div>

                </div>

              </div>

            </div>

          ))}

        </div>

      </div>

    </main>

  )

}