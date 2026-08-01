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
