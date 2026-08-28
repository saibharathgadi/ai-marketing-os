import { generateStructuredJSON } from "./aiProvider"
import { contentItemTypeLabels, type ContentItemType } from "./contentItems"

type CreativeGeneratorInput = {
  type: ContentItemType
  title: string
  body: Record<string, unknown>
  notes: string | null
}

type CreativeVariationDraft = {
  headline: string
  body: string
}

type CreativeGeneratorResult = {
  variations: CreativeVariationDraft[]
  source: "gemini" | "openai" | "fallback"
}

const FALLBACK_PREFIXES = ["Try:", "New:", "Introducing:"]

function buildFallbackVariations(title: string): CreativeVariationDraft[] {
  return FALLBACK_PREFIXES.map((prefix) => ({
    headline: `${prefix} ${title}`,
    body: title
  }))
}

function summarizeBody(body: Record<string, unknown>): string {
  return Object.entries(body)
    .filter(([key, value]) => typeof value === "string" && key !== "creativeVariations")
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n")
}

function buildPrompts(input: CreativeGeneratorInput) {
  const systemPrompt =
    "You are a marketing copywriter. Given a content idea, generate " +
    "exactly 3 distinct creative variations, each a short headline plus " +
    "1-2 sentences of supporting copy. Vary the angle across the three " +
    "(e.g. benefit-led, curiosity-led, urgency-led). Return JSON only, " +
    'matching this exact structure: {"variations":[{"headline":"...",' +
    '"body":"..."},{"headline":"...","body":"..."},{"headline":"...",' +
    '"body":"..."}]}'

  const bodySummary = summarizeBody(input.body)

  const userPrompt = [
    `Content type: ${contentItemTypeLabels[input.type]}`,
    `Title: ${input.title}`,
    input.notes ? `Notes: ${input.notes}` : null,
    bodySummary ? `Additional context:\n${bodySummary}` : null
  ]
    .filter(Boolean)
    .join("\n\n")

  return { systemPrompt, userPrompt }
}

function extractValidVariations(data: Record<string, unknown>): CreativeVariationDraft[] {
  const rawVariations = data.variations

  if (!Array.isArray(rawVariations)) {
    return []
  }

  return rawVariations
    .map((entry) => {
      const headline =
        typeof entry?.headline === "string" ? entry.headline.trim() : ""

      const body =
        typeof entry?.body === "string" ? entry.body.trim() : ""

      return { headline, body }
    })
    .filter((variation) => variation.headline || variation.body)
}

export async function generateCreativeVariations(
  input: CreativeGeneratorInput
): Promise<CreativeGeneratorResult> {
  const { systemPrompt, userPrompt } = buildPrompts(input)

  const result = await generateStructuredJSON({ systemPrompt, userPrompt })

  if (result) {
    const variations = extractValidVariations(result.data)

    if (variations.length > 0) {
      return { variations, source: result.source }
    }
  }

  return {
    variations: buildFallbackVariations(input.title),
    source: "fallback"
  }
}
