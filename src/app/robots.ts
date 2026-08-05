import type { MetadataRoute } from "next"

const baseUrl = "https://verolyx.in"

// Same private routes disallowed for every agent below.
const disallow = [
  "/dashboard",
  "/content",
  "/campaigns",
  "/audit",
  "/login"
]

// Same crawler names Verolyx's own AIO scoring checks for
// (answerEngineSeo.ts) — explicitly allowed here so the site practices
// what it audits: nothing here blocks the AI crawlers that power
// answer/generative-engine citation.
const answerEngineCrawlers = [
  "GPTBot",
  "ChatGPT-User",
  "ClaudeBot",
  "anthropic-ai",
  "PerplexityBot",
  "Google-Extended"
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow
      },
      ...answerEngineCrawlers.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow
      }))
    ],
    sitemap: `${baseUrl}/sitemap.xml`
  }
}
