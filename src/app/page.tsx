"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

type AnalyzeResponse = {
  success: boolean
  error?: string
  data?: {
    auditId: string
  }
}

export default function Home() {

  const router = useRouter()

  const [url, setUrl] =
    useState("")

  const [loading, setLoading] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  async function handleAnalyze() {

    if (!url.trim()) {
      setError("Please enter a website URL.")
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

        setError("Please enter a valid website URL.")
        return

      }

    } catch {

      setError("Please enter a valid website URL.")
      return

    }

    setLoading(true)
    setError(null)

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

      const result: AnalyzeResponse =
        await response.json()

      if (!result.success || !result.data?.auditId) {
        setError(
          result.error ||
            "Something went wrong while analyzing the website."
        )
        setLoading(false)
        return
      }

      // Navigate straight to the full audit — health scores, AI
      // Marketing Copilot tabs, everything — rather than duplicating a
      // stripped-down summary on this page.
      router.push(`/audit/${result.data.auditId}`)

    } catch (error) {

      console.error(error)

      setError(
        "Something went wrong while analyzing the website."
      )

      setLoading(false)

    }

  }

  return (

    <main className="min-h-screen bg-black text-white">

      <div className="max-w-3xl mx-auto px-6 py-20">

        <div className="text-center">

          <h1 className="text-4xl md:text-5xl font-bold">
            Run a Complete Digital Marketing Audit
          </h1>

          <p className="text-zinc-400 mt-5 text-lg max-w-2xl mx-auto">
            SEO, AEO, AIO, and GEO scoring, a full-site crawl, and an
            AI-generated content, campaign, and roadmap plan — in one report.
          </p>

        </div>

        <Card className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

          <div className="flex flex-col md:flex-row gap-4">

            <input
              type="text"
              placeholder="https://example.com"
              value={url}
              onChange={(e) =>
                setUrl(e.target.value)
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) {
                  handleAnalyze()
                }
              }}
              className="flex-1 rounded-xl bg-black border border-zinc-700 px-5 py-4 outline-none focus:border-violet-500"
            />

            <Button
              onClick={handleAnalyze}
              disabled={loading}
              size="lg"
              className="px-8 py-4 h-auto text-base"
            >

              {loading
                ? "Analyzing…"
                : "Analyze"}

            </Button>

          </div>

          <p className="text-zinc-500 text-xs mt-3">
            A full crawl typically takes 20–45 seconds depending on site size.
          </p>

        </Card>

        {error && (

          <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-red-300">
            {error}
          </div>

        )}

      </div>

    </main>

  )

}
