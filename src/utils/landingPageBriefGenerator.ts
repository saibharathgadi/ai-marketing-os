import { generateStructuredJSON, type AIProviderSource } from "./aiProvider"

type BriefSection = {
  name: string
  purpose: string
  copyHint: string
  expandedCopy: string
}

type BrandProfileContext = {
  businessDescription: string | null
  targetAudience: string | null
  toneOfVoice: string | null
  keyDifferentiators: string | null
} | null

type LandingPageBriefInput = {
  targetOffer: string
  campaign: {
    name: string
    objective: string | null
    targetAudience: string | null
    keyMessage: string | null
  }
  brandProfile?: BrandProfileContext
}

type LandingPageBriefResult = {
  sections: BriefSection[]
  source: AIProviderSource
}

const MAX_SECTIONS = 8

function buildFallbackSections(targetOffer: string): BriefSection[] {
  return [
    {
      name: "Hero",
      purpose: "Immediately communicate the offer and hook the visitor.",
      copyHint: "Lead with the core benefit, not the feature.",
      expandedCopy: `A headline stating the value of "${targetOffer}" in outcome terms, a short supporting line, and a primary call-to-action button above the fold.`
    },
    {
      name: "Benefits",
      purpose: "Explain why this offer matters to the visitor.",
      copyHint: "3-4 concrete benefits, not generic claims.",
      expandedCopy: "A short row or grid of the top benefits, each with a one-line explanation of the outcome it delivers."
    },
    {
      name: "Social Proof",
      purpose: "Build trust before asking for the conversion.",
      copyHint: "Testimonials, logos, or numbers.",
      expandedCopy: "Customer quotes, review scores, or usage numbers that make the offer feel proven rather than unverified."
    },
    {
      name: "Call to Action",
      purpose: "Give the visitor a clear next step.",
      copyHint: "Restate the offer, remove friction, one clear button.",
      expandedCopy: `A closing section restating "${targetOffer}" with a single, unambiguous call-to-action and any risk-reversal (guarantee, free trial, no credit card, etc.) that removes hesitation.`
    }
  ]
}

function buildPrompts(input: LandingPageBriefInput) {
  const systemPrompt =
    "You are a conversion copywriter producing a landing page brief. Given " +
    "a target offer and campaign context, produce a detailed, wireframe-" +
    "level page brief: between 4 and 7 sections tailored to this specific " +
    "offer (not a generic template), each with a section name, its " +
    "purpose, a short copy hint, and expanded copy direction (2-3 " +
    "sentences of concrete guidance on what that section's headline and " +
    "body should communicate). If brandProfile is present, write the copy " +
    "direction in the stated tone of voice, targeted at the stated " +
    "audience, and reflecting the stated differentiators. If brandProfile " +
    "is absent, proceed exactly as you would without it. Return JSON " +
    'only, matching this exact structure: {"sections":[{"name":"...",' +
    '"purpose":"...","copyHint":"...","expandedCopy":"..."}]}'

  const userPrompt = [
    `Target offer: ${input.targetOffer}`,
    `Campaign: ${input.campaign.name}`,
    input.campaign.objective ? `Objective: ${input.campaign.objective}` : null,
    input.campaign.targetAudience
      ? `Target audience: ${input.campaign.targetAudience}`
      : null,
    input.campaign.keyMessage ? `Key message: ${input.campaign.keyMessage}` : null,
    input.brandProfile?.businessDescription
      ? `Business: ${input.brandProfile.businessDescription}`
      : null,
    input.brandProfile?.targetAudience
      ? `Brand target audience: ${input.brandProfile.targetAudience}`
      : null,
    input.brandProfile?.toneOfVoice
      ? `Tone of voice: ${input.brandProfile.toneOfVoice}`
      : null,
    input.brandProfile?.keyDifferentiators
      ? `Key differentiators: ${input.brandProfile.keyDifferentiators}`
      : null
  ]
    .filter(Boolean)
    .join("\n")

  return { systemPrompt, userPrompt }
}

function extractValidSections(data: Record<string, unknown>): BriefSection[] {
  const rawSections = data.sections

  if (!Array.isArray(rawSections)) {
    return []
  }

  return rawSections
    .map((entry) => ({
      name: typeof entry?.name === "string" ? entry.name.trim() : "",
      purpose: typeof entry?.purpose === "string" ? entry.purpose.trim() : "",
      copyHint: typeof entry?.copyHint === "string" ? entry.copyHint.trim() : "",
      expandedCopy:
        typeof entry?.expandedCopy === "string" ? entry.expandedCopy.trim() : ""
    }))
    .filter((section) => section.name && section.expandedCopy)
    .slice(0, MAX_SECTIONS)
}

export async function generateLandingPageBrief(
  input: LandingPageBriefInput
): Promise<LandingPageBriefResult> {
  const { systemPrompt, userPrompt } = buildPrompts(input)

  const result = await generateStructuredJSON({ systemPrompt, userPrompt })

  if (result) {
    const sections = extractValidSections(result.data)

    if (sections.length > 0) {
      return { sections, source: result.source }
    }
  }

  return {
    sections: buildFallbackSections(input.targetOffer),
    source: "fallback"
  }
}
