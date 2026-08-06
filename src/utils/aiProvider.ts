/**
 * Shared AI entry point for every JSON-generation call site in the app.
 * Tries providers in order of "genuinely free" first so the whole product
 * works at zero cost: Gemini's free tier (GEMINI_API_KEY) before OpenAI
 * (OPENAI_API_KEY, only used if the user has credits). Returns null if no
 * provider is configured or every provider call fails, so callers can fall
 * back to rule-based generation instead of hard-failing.
 */

type StructuredJSONInput = {
  systemPrompt: string
  userPrompt: string
}

async function generateWithGemini(
  input: StructuredJSONInput,
  apiKey: string
): Promise<Record<string, unknown> | null> {
  // "gemini-flash-latest" is a self-updating alias Google provides
  // specifically so callers don't have to track model version sunsets —
  // pinned versions (e.g. gemini-2.0-flash) get their free-tier quota
  // zeroed out once superseded, which is exactly what broke this call
  // before switching to the alias.
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: input.systemPrompt }]
        },
        contents: [
          {
            role: "user",
            parts: [{ text: input.userPrompt }]
          }
        ],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: "application/json"
        }
      })
    }
  )

  if (!response.ok) {
    throw new Error(
      `Gemini request failed with status ${response.status}`
    )
  }

  const data = await response.json()

  const content =
    data.candidates?.[0]?.content?.parts?.[0]?.text

  if (!content) {
    throw new Error("Empty Gemini response")
  }

  return JSON.parse(content)
}

async function generateWithOpenAI(
  input: StructuredJSONInput,
  apiKey: string
): Promise<Record<string, unknown> | null> {
  const response = await fetch(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: input.systemPrompt
          },
          {
            role: "user",
            content: input.userPrompt
          }
        ]
      })
    }
  )

  if (!response.ok) {
    throw new Error(
      `OpenAI request failed with status ${response.status}`
    )
  }

  const data = await response.json()

  const content = data.choices?.[0]?.message?.content

  if (!content) {
    throw new Error("Empty OpenAI response")
  }

  return JSON.parse(content)
}

/**
 * Best-effort live research via Gemini's Google Search grounding tool.
 * Used to ground factual claims (current company names/ownership,
 * competitor landscape) in real, current web results instead of the
 * model's own training data, which can go stale (e.g. asserting an
 * outdated corporate parent after a spinoff).
 *
 * Deliberately a separate call rather than folded into
 * generateStructuredJSON: the Gemini API does not support combining the
 * `google_search` tool with `responseMimeType: "application/json"` in a
 * single request, so grounding requires its own plain-text call whose
 * output is then fed as context into the structured-JSON call. Gemini
 * free-tier only (no Google Search grounding equivalent for OpenAI here);
 * returns null on any failure so callers can proceed without it.
 */
export async function generateGroundedResearch(
  query: string
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    return null
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20_000)

    let response: Response

    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: query }]
              }
            ],
            tools: [{ google_search: {} }],
            generationConfig: {
              temperature: 0.3
            }
          }),
          signal: controller.signal
        }
      )
    } finally {
      clearTimeout(timeout)
    }

    if (!response.ok) {
      throw new Error(
        `Gemini grounded research request failed with status ${response.status}`
      )
    }

    const data = await response.json()

    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map((part: { text?: string }) => part.text ?? "")
      .join("")
      .trim()

    return text || null
  } catch (error) {
    console.error("Gemini grounded research failed:", error)
    return null
  }
}

export type GroundedCitation = {
  uri: string
  title: string
  domain: string | null
}

export type GroundedCitationsResult = {
  answer: string
  citations: GroundedCitation[]
  citedDomains: string[]
}

// Gemini's grounding chunks carry a vertexaisearch.cloud.google.com
// redirect-proxy URL, not the cited site's real URL -- a bare
// new URL(uri).hostname always yields Google's redirector domain, not
// the source. Follow the redirect to get the real destination.
async function resolveGroundingChunkDomain(
  uri: string,
  title: string
): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5_000)

    let response: Response

    try {
      response = await fetch(uri, {
        redirect: "follow",
        signal: controller.signal
      })
    } finally {
      clearTimeout(timeout)
    }

    const hostname = new URL(response.url).hostname.replace(/^www\./, "")

    if (hostname && hostname !== "vertexaisearch.cloud.google.com") {
      return hostname
    }
  } catch {
    // Fall through to the title-based fallback below.
  }

  // Fallback only when the redirect-follow didn't resolve: some
  // grounding chunks carry a bare hostname in `title` rather than a
  // full page title. Never treat an arbitrary title as a domain --
  // that would silently corrupt the citation list.
  if (/^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(title)) {
    return title.replace(/^www\./, "")
  }

  return null
}

/**
 * Same grounded-search mechanism as generateGroundedResearch, but also
 * captures which sources Google's grounding actually cited (used for
 * AI citation tracking -- "is this domain currently being cited for
 * this query," not a numeric SERP rank). A deliberate sibling, not a
 * refactor of generateGroundedResearch, so the existing one-shot
 * research call in aiCopilot.ts is unaffected.
 */
export async function generateGroundedCitations(
  query: string
): Promise<GroundedCitationsResult | null> {
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    return null
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20_000)

    let response: Response

    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: query }]
              }
            ],
            tools: [{ google_search: {} }],
            generationConfig: {
              temperature: 0.3
            }
          }),
          signal: controller.signal
        }
      )
    } finally {
      clearTimeout(timeout)
    }

    if (!response.ok) {
      throw new Error(
        `Gemini grounded citations request failed with status ${response.status}`
      )
    }

    const data = await response.json()
    const candidate = data.candidates?.[0]

    const answer = (candidate?.content?.parts ?? [])
      .map((part: { text?: string }) => part.text ?? "")
      .join("")
      .trim()

    const rawChunks: { web?: { uri?: string; title?: string } }[] =
      candidate?.groundingMetadata?.groundingChunks ?? []

    const citations = await Promise.all(
      rawChunks
        .filter((chunk) => chunk.web?.uri)
        .map(async (chunk) => {
          const uri = chunk.web!.uri!
          const title = chunk.web!.title ?? ""

          return {
            uri,
            title,
            domain: await resolveGroundingChunkDomain(uri, title)
          }
        })
    )

    const citedDomains = Array.from(
      new Set(
        citations
          .map((citation) => citation.domain)
          .filter((domain): domain is string => domain !== null)
      )
    )

    return { answer, citations, citedDomains }
  } catch (error) {
    console.error("Gemini grounded citations failed:", error)
    return null
  }
}

export type AIProviderSource = "gemini" | "openai" | "fallback"

export async function generateStructuredJSON(
  input: StructuredJSONInput
): Promise<{
  data: Record<string, unknown>
  source: AIProviderSource
} | null> {
  const geminiKey = process.env.GEMINI_API_KEY

  if (geminiKey) {
    try {
      const data = await generateWithGemini(input, geminiKey)

      if (data) {
        return { data, source: "gemini" }
      }
    } catch (error) {
      console.error("Gemini generation failed:", error)
    }
  }

  const openaiKey = process.env.OPENAI_API_KEY

  if (openaiKey) {
    try {
      const data = await generateWithOpenAI(input, openaiKey)

      if (data) {
        return { data, source: "openai" }
      }
    } catch (error) {
      console.error("OpenAI generation failed:", error)
    }
  }

  return null
}
