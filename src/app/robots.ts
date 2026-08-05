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
    rules: {
      // A single rule with multiple userAgent entries produces one
      // shared "User-agent:" group per the robots.txt spec, instead of
      // repeating the same Allow/Disallow lines once per crawler.
      userAgent: ["*", ...answerEngineCrawlers],
      allow: "/",
      disallow
    },
    sitemap: `${baseUrl}/sitemap.xml`
  }
}
