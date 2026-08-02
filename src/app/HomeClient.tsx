"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

type AnalyzeResponse = {
  success: boolean
  error?: string
  data?: {
    auditId: string
  }
}

const faqs = [
  {
    question: "What does a full audit check?",
    answer:
      "Every crawled page is scored for classic technical SEO plus AEO (answer-engine optimization), AIO (AI-crawler access), and GEO (generative-engine citation readiness) — then the results feed an AI-generated content, campaign, and 90-day roadmap plan."
  },
  {
    question: "Is AI Marketing OS free to use?",
    answer:
      "Yes. Every audit and AI-generated recommendation runs on free-tier resources — there's no paid plan required to get a full report."
  },
  {
    question: "What are AEO and GEO, and why do they matter?",
    answer:
      "AEO measures how well a page is structured to be picked as a direct answer by tools like Google's AI Overviews and Perplexity. GEO measures how likely a page is to be cited by generative engines like ChatGPT. Both matter more every year as search shifts from ranked links to AI-generated answers."
  },
  {
    question: "How long does a crawl take?",
    answer:
      "A full site crawl — sitemap discovery plus multi-level link following — typically takes 20-45 seconds depending on site size, then a short additional step generates the AI marketing plan."
  },
  {
    question: "Do I need an account to run an audit?",
    answer:
      "Yes — audits are saved to your account so you can track score changes over time, schedule recurring audits, and revisit past reports."
  }
]

const faqStructuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer
    }
  }))
}

export default function HomeClient() {

  const router = useRouter()

  const [url, setUrl] =
    useState("")

  const [loading, setLoading] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  const [requiresLogin, setRequiresLogin] =
    useState(false)

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
    setRequiresLogin(false)

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

      if (response.status === 401) {
        setRequiresLogin(true)
        setLoading(false)
        return
      }

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

    <main className="relative min-h-screen bg-background text-foreground overflow-hidden">

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[image:var(--gradient-glow)]"
      />

      <div className="max-w-3xl mx-auto px-6 py-20">

        <div className="text-center">

          <h1 className="text-4xl md:text-5xl font-bold">
            Run a Complete Digital Marketing Audit
          </h1>

          <p className="text-muted-foreground mt-5 text-lg max-w-2xl mx-auto">
            SEO, AEO, AIO, and GEO scoring, a full-site crawl, and an
            AI-generated content, campaign, and roadmap plan — in one report.
          </p>

        </div>

        <Card className="mt-10 rounded-2xl border border-border bg-card p-6">

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
              className="flex-1 rounded-xl bg-background border border-border px-5 py-4 outline-none focus:border-primary"
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

          <p className="text-muted-foreground text-xs mt-3">
            A full crawl typically takes 20–45 seconds depending on site size.
          </p>

        </Card>

        {requiresLogin && (

          <div className="mt-6 rounded-2xl border border-violet-500/20 bg-violet-500/10 p-6 text-violet-200">
            Please{" "}
            <Link href="/login" className="underline font-semibold">
              log in
            </Link>{" "}
            to run a full audit.
          </div>

        )}

        {error && (

          <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-red-300">
            {error}
          </div>

        )}

        <section className="mt-24">

          <p className="text-muted-foreground text-sm uppercase tracking-wide text-center">
            FAQ
          </p>

          <div className="mt-6 space-y-8">

            {faqs.map((faq) => (

              <div key={faq.question}>
                <h2 className="text-xl font-semibold">{faq.question}</h2>
                <p className="text-muted-foreground mt-2 leading-relaxed">{faq.answer}</p>
              </div>

            ))}

          </div>

        </section>

      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqStructuredData)
        }}
      />

    </main>

  )

}
