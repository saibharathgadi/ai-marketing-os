export type ContentBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "list"; items: string[] }

export type BlogPost = {
  slug: string
  title: string
  description: string
  publishedAt: string
  content: ContentBlock[]
}

export const blogPosts: BlogPost[] = [
  {
    slug: "what-is-aeo",
    title: "What Is AEO? Answer Engine Optimization Explained",
    description:
      "AEO measures how well a page is structured to be picked as a direct answer by tools like Google's AI Overviews, ChatGPT, and Perplexity. Here's what that actually means and how to improve it.",
    publishedAt: "2026-08-05",
    content: [
      {
        type: "paragraph",
        text: "For twenty years, ranking well meant showing up in a list of ten blue links. That's changing fast. When someone asks Google's AI Overviews, ChatGPT, or Perplexity a question, they often get one direct answer, pulled from one source. Answer Engine Optimization, or AEO, is the practice of structuring your content so your page is the one that gets picked."
      },
      {
        type: "heading",
        text: "How is AEO different from regular SEO?"
      },
      {
        type: "paragraph",
        text: "Classic SEO optimizes for ranking algorithms that crawl links and keywords, then hand back a list of results for a person to click through. AEO optimizes for an answer engine that reads your page, extracts a specific fact or explanation, and presents it directly, often without sending any traffic to your site at all. The goal shifts from \"rank higher\" to \"get quoted correctly.\""
      },
      {
        type: "heading",
        text: "What actually makes a page AEO-friendly?"
      },
      {
        type: "paragraph",
        text: "Answer engines look for content that's already shaped like an answer. Three signals matter most:"
      },
      {
        type: "list",
        items: [
          "FAQPage structured data. Marking up a genuine question-and-answer section with schema.org's FAQPage type gives answer engines a machine-readable signal that says exactly where the questions and answers are.",
          "Question-style headings. A heading like \"What is AEO?\" is far easier for an answer engine to match against a user's actual question than a vague heading like \"Overview\" or \"Background.\"",
          "HowTo structured data. If a page walks through a process step by step, HowTo schema marks up each step so it can be surfaced as a direct, step-by-step answer."
        ]
      },
      {
        type: "heading",
        text: "Why this matters more every year"
      },
      {
        type: "paragraph",
        text: "Search behavior is shifting from clicking links to reading answers. A page that never gets picked as the answer effectively becomes invisible for that query, no matter how well it would have ranked in a traditional results page. Structuring content for AEO now is the same kind of early move that structuring content for mobile search was a decade ago."
      },
      {
        type: "paragraph",
        text: "Verolyx scores every crawled page for exactly these three signals as part of a free audit, along with AIO and GEO scoring. Run a check on your own site to see where you stand."
      }
    ]
  },
  {
    slug: "what-is-geo",
    title: "What Is GEO? Generative Engine Optimization Explained",
    description:
      "GEO measures how likely a page is to be cited by generative engines like ChatGPT and Perplexity. Here's what actually influences whether an LLM quotes your content or someone else's.",
    publishedAt: "2026-08-05",
    content: [
      {
        type: "paragraph",
        text: "When a large language model answers a question and cites a source, it made a choice. Out of everything it could have pulled from, it picked one page over the rest. Generative Engine Optimization, or GEO, is the practice of making your content the one that gets picked."
      },
      {
        type: "heading",
        text: "How LLMs actually decide what to cite"
      },
      {
        type: "paragraph",
        text: "Generative engines aren't reading your page the way a search algorithm counts keywords. They're evaluating whether a passage looks credible and easy to extract cleanly. Three factors carry real weight:"
      },
      {
        type: "list",
        items: [
          "Author and source credibility signals. Author schema markup, a visible byline, or rel=\"author\" attribution all tell a generative engine that a real, identifiable source stands behind the claim, which matters a lot when the engine is deciding whose version of a fact to trust.",
          "Data and statistics. A specific number or percentage is more quotable than a vague claim. \"Conversion rates improved 34%\" is something an LLM can lift directly into an answer. \"Conversion rates improved significantly\" is not.",
          "Lists and tables. Structured, scannable formatting is dramatically easier for a model to parse and extract verbatim than a wall of unbroken paragraphs."
        ]
      },
      {
        type: "heading",
        text: "GEO versus AEO: related, not identical"
      },
      {
        type: "paragraph",
        text: "AEO is about being structured well enough to be selected as a direct answer, mostly by answer-box style features like Google's AI Overviews. GEO is about being credible and extractable enough to be cited by a generative model synthesizing a longer response, like ChatGPT or Perplexity. A page can score well on one and poorly on the other. Most sites need both."
      },
      {
        type: "heading",
        text: "Why this is worth fixing now"
      },
      {
        type: "paragraph",
        text: "Once a generative engine settles on a source for a given question, that source can end up cited across millions of conversations without ever sending a single visitor a link to click. Being the cited source is a new kind of visibility, and right now, most sites haven't structured anything specifically to earn it."
      },
      {
        type: "paragraph",
        text: "Verolyx checks every crawled page for author credibility signals, data density, and structured formatting as part of GEO scoring in a free audit, alongside AEO and AIO. Run a check to see exactly what's blocking your citation readiness."
      }
    ]
  },
  {
    slug: "seo-vs-aeo-vs-aio-vs-geo",
    title: "SEO vs AEO vs AIO vs GEO: What's the Difference?",
    description:
      "Four acronyms, four different jobs. Here's a clear breakdown of what each one measures, why they overlap but don't replace each other, and how Verolyx scores all four in one audit.",
    publishedAt: "2026-08-05",
    content: [
      {
        type: "paragraph",
        text: "Search has quietly split into four separate disciplines, and most of the confusion comes from treating them as one thing. Here's what each acronym actually measures."
      },
      {
        type: "heading",
        text: "SEO: can a search engine rank your page"
      },
      {
        type: "paragraph",
        text: "Classic technical SEO covers the fundamentals: meta tags, heading structure, word count, and the kind of on-page issues that have mattered since search engines started crawling the web. This is the foundation everything else builds on. A page with broken fundamentals won't get far no matter how well it's optimized for AI."
      },
      {
        type: "heading",
        text: "AIO: can an AI crawler even read your page"
      },
      {
        type: "paragraph",
        text: "Before any answer engine or generative model can consider citing your content, its crawler has to actually reach it. AIO checks whether robots.txt is blocking bots like GPTBot or ClaudeBot, whether a /llms.txt file exists to guide AI agents to your key content, and whether your heading hierarchy is clean enough for a machine to parse the page's structure correctly. This is access, not persuasion. A page can be blocked from AI crawlers entirely and never even enter the running."
      },
      {
        type: "heading",
        text: "AEO: can you be picked as the direct answer"
      },
      {
        type: "paragraph",
        text: "Once a page is reachable, AEO measures whether it's structured to be selected as a direct answer, the kind that shows up in Google's AI Overviews or gets read aloud by a voice assistant. This comes down to FAQPage schema, question-style headings, and HowTo markup for step-by-step content."
      },
      {
        type: "heading",
        text: "GEO: will a generative engine cite you"
      },
      {
        type: "paragraph",
        text: "GEO measures citation readiness for generative engines like ChatGPT and Perplexity, the kind that synthesize a longer answer and credit a source. This depends on author credibility signals, concrete data and statistics, and scannable formatting like lists and tables."
      },
      {
        type: "heading",
        text: "Why you need all four, not just one"
      },
      {
        type: "paragraph",
        text: "These four checks build on each other. Solid technical SEO is the base. AIO makes sure AI systems can actually reach that base. AEO and GEO then determine whether they choose to feature or cite what they find. Optimizing for only one leaves real visibility on the table."
      },
      {
        type: "paragraph",
        text: "Verolyx scores every crawled page across all four pillars in a single free audit, then generates an AI-written content, campaign, and 90-day roadmap plan from the results. Run an audit to see exactly where your site stands on each one."
      }
    ]
  }
]
