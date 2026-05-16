"use client"

import { useState } from "react"

type AuditResult = {
  success: boolean
  error?: string
  data?: {
    homepageAnalysis: {
      title: string
      metaDescription: string | null
      h1s: string[]
      h2s: string[]
      h3s: string[]
      wordCount: number
      seoIssues: string[]
      seoScore: number
    }

    technicalSeo: {
      robotsTxt: boolean
      sitemap: boolean
      canonical: boolean
      openGraph: boolean
      twitterCards: boolean
      schemaMarkup: boolean
    }

    internalLinks: string[]

    crawledPages: Array<{
      url: string
      seoScore: number
      wordCount: number
      seoIssues: string[]
    }>

    siteSummary: {
      totalPages: number
      averageSeoScore: number
      totalIssues: number

      bestPage: {
        url: string
        seoScore: number
      }

      worstPage: {
        url: string
        seoScore: number
      }
    }
  }
}

export default function Home() {

  const [url, setUrl] =
    useState("")

  const [loading, setLoading] =
    useState(false)

  const [result, setResult] =
    useState<AuditResult | null>(null)

  async function handleAnalyze() {

    if (!url.trim()) {

      setResult({
        success: false,
        error:
          "Please enter a website URL."
      })

      return

    }

    let normalizedUrl =
      url.trim()

    if (
      !normalizedUrl.startsWith(
        "http://"
      ) &&
      !normalizedUrl.startsWith(
        "https://"
      )
    ) {

      normalizedUrl =
        `https://${normalizedUrl}`

    }

    try {

      const parsedUrl =
        new URL(normalizedUrl)

      if (
        !parsedUrl.hostname.includes(".")
      ) {

        setResult({
          success: false,
          error:
            "Please enter a valid website URL."
        })

        return

      }

    } catch {

      setResult({
        success: false,
        error:
          "Please enter a valid website URL."
      })

      return

    }

    setLoading(true)

    setResult(null)

    try {

      const response =
        await fetch("/api/analyze", {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            url: normalizedUrl
          })
        })

      const data =
        await response.json()

      setResult(data)

    } catch (error) {

      console.error(error)

      setResult({
        success: false,
        error:
          "Something went wrong while analyzing the website."
      })

    } finally {

      setLoading(false)

    }

  }

  return (

    <main className="min-h-screen bg-black text-white">

      <div className="max-w-7xl mx-auto px-6 py-16">

        <div className="text-center">

          <h1 className="text-6xl font-bold">
            AI Marketing OS
          </h1>

          <p className="text-zinc-400 mt-6 text-lg max-w-2xl mx-auto">
            AI-powered SEO auditing platform with
            crawling, analysis, recommendations,
            dashboards, and reporting.
          </p>

        </div>

        <div className="mt-12 max-w-3xl mx-auto">

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

            <div className="flex flex-col md:flex-row gap-4">

              <input
                type="text"
                placeholder="https://example.com"
                value={url}
                onChange={(e) =>
                  setUrl(e.target.value)
                }
                className="flex-1 rounded-xl bg-black border border-zinc-700 px-5 py-4 outline-none"
              />

              <button
                onClick={handleAnalyze}
                disabled={loading}
                className="rounded-xl bg-white text-black px-8 py-4 font-semibold disabled:opacity-50"
              >

                {loading
                  ? "Analyzing..."
                  : "Analyze"}

              </button>

            </div>

          </div>

        </div>

        {result && !result.success && (

          <div className="max-w-3xl mx-auto mt-8 rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-red-300">

            {result.error}

          </div>

        )}

        {result?.success &&
          result?.data?.siteSummary && (

          <div className="mt-16">

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

                <p className="text-zinc-400 text-sm">
                  Average SEO Score
                </p>

                <h2 className="text-5xl font-bold mt-3">
                  {
                    result.data.siteSummary
                      .averageSeoScore
                  }
                </h2>

              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

                <p className="text-zinc-400 text-sm">
                  Total Pages
                </p>

                <h2 className="text-5xl font-bold mt-3">
                  {
                    result.data.siteSummary
                      .totalPages
                  }
                </h2>

              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

                <p className="text-zinc-400 text-sm">
                  Total Issues
                </p>

                <h2 className="text-5xl font-bold mt-3">
                  {
                    result.data.siteSummary
                      .totalIssues
                  }
                </h2>

              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

                <p className="text-zinc-400 text-sm">
                  Homepage Score
                </p>

                <h2 className="text-5xl font-bold mt-3">
                  {
                    result.data
                      .homepageAnalysis
                      .seoScore
                  }
                </h2>

              </div>

            </div>

            <div className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

              <h2 className="text-2xl font-semibold">
                Technical SEO
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">

                <div className="rounded-xl bg-zinc-950 p-4">
                  {result.data.technicalSeo.robotsTxt
                    ? "✅ robots.txt found"
                    : "❌ robots.txt missing"}
                </div>

                <div className="rounded-xl bg-zinc-950 p-4">
                  {result.data.technicalSeo.sitemap
                    ? "✅ sitemap.xml found"
                    : "❌ sitemap.xml missing"}
                </div>

                <div className="rounded-xl bg-zinc-950 p-4">
                  {result.data.technicalSeo.canonical
                    ? "✅ canonical tag found"
                    : "❌ canonical tag missing"}
                </div>

                <div className="rounded-xl bg-zinc-950 p-4">
                  {result.data.technicalSeo.openGraph
                    ? "✅ OpenGraph tags found"
                    : "❌ OpenGraph tags missing"}
                </div>

                <div className="rounded-xl bg-zinc-950 p-4">
                  {result.data.technicalSeo.twitterCards
                    ? "✅ Twitter cards found"
                    : "❌ Twitter cards missing"}
                </div>

                <div className="rounded-xl bg-zinc-950 p-4">
                  {result.data.technicalSeo.schemaMarkup
                    ? "✅ Schema markup found"
                    : "❌ Schema markup missing"}
                </div>

              </div>

            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-10">

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

                <p className="text-zinc-400 text-sm">
                  Best Performing Page
                </p>

                <h2 className="text-xl font-semibold mt-4 break-all">
                  {
                    result.data.siteSummary
                      .bestPage?.url
                  }
                </h2>

                <p className="mt-4 text-5xl font-bold">
                  {
                    result.data.siteSummary
                      .bestPage?.seoScore
                  }
                </p>

              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

                <p className="text-zinc-400 text-sm">
                  Worst Performing Page
                </p>

                <h2 className="text-xl font-semibold mt-4 break-all">
                  {
                    result.data.siteSummary
                      .worstPage?.url
                  }
                </h2>

                <p className="mt-4 text-5xl font-bold">
                  {
                    result.data.siteSummary
                      .worstPage?.seoScore
                  }
                </p>

              </div>

            </div>

            <div className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">

              <div className="p-6 border-b border-zinc-800">

                <h2 className="text-2xl font-semibold">
                  Crawled Pages
                </h2>

              </div>

              <div className="overflow-auto">

                <table className="w-full text-sm">

                  <thead className="bg-zinc-950">

                    <tr>

                      <th className="text-left p-4">
                        URL
                      </th>

                      <th className="text-left p-4">
                        SEO Score
                      </th>

                      <th className="text-left p-4">
                        Word Count
                      </th>

                      <th className="text-left p-4">
                        Issues
                      </th>

                    </tr>

                  </thead>

                  <tbody>

                    {result.data.crawledPages.map(
                      (
                        page,
                        index
                      ) => (

                        <tr
                          key={index}
                          className="border-t border-zinc-800 align-top"
                        >

                          <td className="p-4 break-all max-w-md">
                            {page.url}
                          </td>

                          <td className="p-4 font-bold">
                            {page.seoScore}
                          </td>

                          <td className="p-4">
                            {page.wordCount}
                          </td>

                          <td className="p-4">

                            <div className="space-y-2">

                              {page.seoIssues
                                ?.length === 0 ? (

                                <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-2 text-green-300">
                                  No Issues
                                </div>

                              ) : (

                                page.seoIssues?.map(
                                  (
                                    issue: string,
                                    issueIndex: number
                                  ) => (

                                    <div
                                      key={
                                        issueIndex
                                      }
                                      className="rounded-lg bg-red-500/10 border border-red-500/20 p-2 text-red-300"
                                    >
                                      {issue}
                                    </div>

                                  )
                                )

                              )}

                            </div>

                          </td>

                        </tr>

                      )
                    )}

                  </tbody>

                </table>

              </div>

            </div>

          </div>

        )}

      </div>

    </main>

  )

}
