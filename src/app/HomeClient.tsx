"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type AnalyzeResponse = {
  success: boolean
  error?: string
  data?: {
    auditId: string
  }
}

const howItWorks = [
  {
    title: "Enter your URL",
    description:
      "Drop in any website address. No account setup or tracking script needed to see a preview."
  },
  {
    title: "We crawl & score it",
    description:
      "A full-site crawl scores every page for technical SEO, AEO, AIO, and GEO in 20-45 seconds."
  },
  {
    title: "Get your AI plan",
    description:
      "AI-generated content, campaign, and a 90-day roadmap, built straight from your audit results."
  }
]

const challenges = [
  {
    challenge: "Your competitors show up in ChatGPT and AI Overviews. You don't.",
    fix: "GEO scoring shows exactly what's blocking citation: missing schema, no FAQ structure, thin content."
  },
  {
    challenge: "You don't know if AI crawlers can even read your site.",
    fix: "AIO scoring checks whether GPTBot, ClaudeBot, and other AI crawlers can access your content at all."
  },
  {
    challenge: "A real SEO audit takes an agency days and costs real money.",
    fix: "A full site crawl finishes in 20-45 seconds, free, with no account needed for a preview."
  },
  {
    challenge: "You get a score, then have to figure out what to do with it yourself.",
    fix: "Every audit includes an AI-generated content, campaign, and 90-day roadmap plan built from your actual results."
  },
  {
    challenge: "AI tools auto-publish things you never reviewed.",
    fix: "Nothing auto-publishes here. You review every AI recommendation and manually save what you want into Content Studio or Campaign Builder."
  }
]

const features = [
  {
    title: "Technical SEO",
    description:
      "Meta tags, headings, word count, and classic on-page issues scored across every crawled page."
  },
  {
    title: "AEO",
    description:
      "Answer-engine optimization: how well a page is structured to be picked as a direct answer by tools like Google's AI Overviews."
  },
  {
    title: "AIO",
    description:
      "AI-crawler access: whether AI bots can actually reach and read your content in the first place."
  },
  {
    title: "GEO",
    description:
      "Generative-engine citation readiness: how likely a page is to be cited by tools like ChatGPT and Perplexity."
  },
  {
    title: "AI Content & Campaigns",
    description:
      "A content, campaign, and 90-day roadmap plan generated from your audit, ready to save straight into Content Studio and Campaign Builder."
  }
]

const faqs = [
  {
    question: "What does a full audit check?",
    answer:
      "Every crawled page is scored for classic technical SEO plus AEO (answer-engine optimization), AIO (AI-crawler access), and GEO (generative-engine citation readiness), then the results feed an AI-generated content, campaign, and 90-day roadmap plan."
  },
  {
    question: "Is Verolyx free to use?",
    answer:
      "Yes. Every audit and AI-generated recommendation runs on free-tier resources, so there's no paid plan required to get a full report."
  },
  {
    question: "What are AEO and GEO, and why do they matter?",
    answer:
      "AEO measures how well a page is structured to be picked as a direct answer by tools like Google's AI Overviews and Perplexity. GEO measures how likely a page is to be cited by generative engines like ChatGPT. Both matter more every year as search shifts from ranked links to AI-generated answers."
  },
  {
    question: "How long does a crawl take?",
    answer:
      "A full site crawl (sitemap discovery plus multi-level link following) typically takes 20-45 seconds depending on site size, then a short additional step generates the AI marketing plan."
  },
  {
    question: "Do I need an account to run an audit?",
    answer:
      "No. Anyone can run a free preview audit without signing up. Creating a free account unlocks the full multi-page crawl, AI-generated insights, and saves your audits so you can track score changes over time."
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

function normalizeAndValidateUrl(
  rawUrl: string
): { success: true; url: string } | { success: false; error: string } {

  if (!rawUrl.trim()) {
    return {
      success: false,
      error: "Please enter a website URL."
    }
  }

  let normalizedUrl = rawUrl.trim()

  if (
    !normalizedUrl.startsWith("http://") &&
    !normalizedUrl.startsWith("https://")
  ) {
    normalizedUrl = `https://${normalizedUrl}`
  }

  try {

    const parsedUrl = new URL(normalizedUrl)

    if (!parsedUrl.hostname.includes(".")) {
      return {
        success: false,
        error: "Please enter a valid website URL."
      }
    }

  } catch {

    return {
      success: false,
      error: "Please enter a valid website URL."
    }

  }

  return { success: true, url: normalizedUrl }

}

export default function HomeClient() {

  const router = useRouter()
  const searchParams = useSearchParams()

  const [url, setUrl] =
    useState(() => searchParams.get("url") ?? "")

  const [loading, setLoading] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  const hasAutoTriggered = useRef(false)

  async function runAnalysis(rawUrl: string) {

    const validation =
      normalizeAndValidateUrl(rawUrl)

    if (!validation.success) {
      setError(validation.error)
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
            url: validation.url
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
      // stripped-down summary on this page. Anonymous visitors land on
      // a trimmed teaser view of the same page; logged-in users land
      // on the full report.
      router.push(`/audit/${result.data.auditId}`)

    } catch (error) {

      console.error(error)

      setError(
        "Something went wrong while analyzing the website."
      )

      setLoading(false)

    }

  }

  function handleAnalyze() {
    void runAnalysis(url)
  }

  // Continuation from the teaser-audit login CTA: `/?url=...` prefills
  // and immediately re-runs a full audit under the now-authenticated
  // session, rather than making the user retype the URL.
  useEffect(() => {

    if (hasAutoTriggered.current) {
      return
    }

    const prefillUrl = searchParams.get("url")

    if (!prefillUrl) {
      return
    }

    hasAutoTriggered.current = true

    // setState only happens after runAnalysis' internal `await`
    // resolves, never synchronously within this effect — fetch-on-mount,
    // not a cascading-render risk.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void runAnalysis(prefillUrl)

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  return (

    <main className="relative min-h-screen bg-background text-foreground overflow-hidden">

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[image:var(--gradient-glow)]"
      />

      <div className="max-w-5xl mx-auto px-6 py-20">

        <div className="max-w-3xl mx-auto">

        <div className="text-center">

          <h1 className="text-4xl md:text-5xl font-bold">
            Will AI Recommend You or Someone Else?
          </h1>

          <p className="text-muted-foreground mt-5 text-lg max-w-2xl mx-auto">
            Run a free instant audit to see if ChatGPT, Perplexity, and
            Google&apos;s AI Overviews can find, read, and cite your site,
            plus get a full SEO crawl and an AI-generated content, campaign,
            and roadmap plan.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 mt-6 text-sm text-muted-foreground">
            <span>GEO citation targets:</span>
            <Badge variant="secondary">ChatGPT</Badge>
            <Badge variant="secondary">Perplexity</Badge>
            <Badge variant="secondary">Google AI Overviews</Badge>
          </div>

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

        {error && (

          <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-red-700 dark:text-red-300">
            {error}
          </div>

        )}

        </div>

        <section className="mt-24">

          <p className="text-muted-foreground text-sm uppercase tracking-wide text-center">
            Sound Familiar?
          </p>

          <div className="mt-8 space-y-3">

            {challenges.map((item) => (

              <div
                key={item.challenge}
                className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-2xl border border-border bg-card p-5"
              >

                <p className="text-muted-foreground">
                  {item.challenge}
                </p>

                <p className="font-medium">
                  {item.fix}
                </p>

              </div>

            ))}

          </div>

        </section>

        <section className="mt-24">

          <p className="text-muted-foreground text-sm uppercase tracking-wide text-center">
            How It Works
          </p>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">

            {howItWorks.map((step, index) => (

              <Card
                key={step.title}
                className="rounded-2xl border border-border bg-card p-6"
              >
                <Badge className="size-8 rounded-full p-0 flex items-center justify-center text-sm">
                  {index + 1}
                </Badge>
                <h3 className="text-lg font-semibold mt-4">
                  {step.title}
                </h3>
                <p className="text-muted-foreground mt-2 leading-relaxed">
                  {step.description}
                </p>
              </Card>

            ))}

          </div>

        </section>

        <section className="mt-24">

          <p className="text-muted-foreground text-sm uppercase tracking-wide text-center">
            What Gets Scored
          </p>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

            {features.map((feature) => (

              <Card
                key={feature.title}
                className="rounded-2xl border border-border bg-card p-6"
              >
                <h3 className="text-lg font-semibold bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground mt-2 leading-relaxed">
                  {feature.description}
                </p>
              </Card>

            ))}

          </div>

        </section>

        <section className="mt-24 max-w-3xl mx-auto">

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
