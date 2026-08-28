import { generateStructuredJSON, type AIProviderSource } from "./aiProvider"
import { deriveBrandName } from "./aiCopilot"

type FaqSchemaInput = {
  siteUrl: string
  executiveSummary?: string | null
  detectedThemes?: string[]
}

type FaqPair = {
  question: string
  answer: string
}

type FaqSchemaResult = {
  faqs: FaqPair[]
  jsonLd: string
  source: AIProviderSource
}

function buildFallbackFaqs(siteUrl: string): FaqPair[] {
  const brandName = deriveBrandName(siteUrl)

  return [
    {
      question: `What does ${brandName} do?`,
      answer: `${brandName} helps customers achieve their goals through its products and services. Replace this with a specific description of what you offer.`
    },
    {
      question: `How can I get started with ${brandName}?`,
      answer: `Visit ${siteUrl} to learn more and get started. Replace this with your actual onboarding steps.`
    }
  ]
}

function buildPrompts(input: FaqSchemaInput) {
  const systemPrompt =
    "You are an SEO/AEO specialist. Given context about a website, generate " +
    "exactly 5 frequently-asked-question-and-answer pairs relevant to this " +
    "business, suitable for a schema.org FAQPage. Answers should be 1-3 " +
    "sentences, factual in tone, and grounded in the provided context " +
    "rather than generic. Return JSON only, matching this exact structure: " +
    '{"faqs":[{"question":"...","answer":"..."},...]}'

  const userPrompt = [
    `Site: ${input.siteUrl}`,
    input.executiveSummary ? `Summary: ${input.executiveSummary}` : null,
    input.detectedThemes && input.detectedThemes.length > 0
      ? `Themes: ${input.detectedThemes.join(", ")}`
      : null
  ]
    .filter(Boolean)
    .join("\n\n")

  return { systemPrompt, userPrompt }
}

function extractValidFaqs(data: Record<string, unknown>): FaqPair[] {
  const rawFaqs = data.faqs

  if (!Array.isArray(rawFaqs)) {
    return []
  }

  return rawFaqs
    .map((entry) => ({
      question:
        typeof entry?.question === "string" ? entry.question.trim() : "",
      answer:
        typeof entry?.answer === "string" ? entry.answer.trim() : ""
    }))
    .filter((faq) => faq.question && faq.answer)
}

function buildFaqPageJsonLd(faqs: FaqPair[]): string {
  const jsonLd = {
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

  return JSON.stringify(jsonLd, null, 2)
}

export async function generateFaqSuggestions(
  input: FaqSchemaInput
): Promise<FaqSchemaResult> {
  const { systemPrompt, userPrompt } = buildPrompts(input)

  const result = await generateStructuredJSON({ systemPrompt, userPrompt })

  if (result) {
    const faqs = extractValidFaqs(result.data)

    if (faqs.length > 0) {
      return { faqs, jsonLd: buildFaqPageJsonLd(faqs), source: result.source }
    }
  }

  const fallbackFaqs = buildFallbackFaqs(input.siteUrl)

  return {
    faqs: fallbackFaqs,
    jsonLd: buildFaqPageJsonLd(fallbackFaqs),
    source: "fallback"
  }
}
