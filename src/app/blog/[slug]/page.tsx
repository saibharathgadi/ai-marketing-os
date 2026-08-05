import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { blogPosts, type ContentBlock } from "@/content/blogPosts"

export function generateStaticParams() {
  return blogPosts.map((post) => ({
    slug: post.slug
  }))
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {

  const { slug } = await params

  const post = blogPosts.find(
    (candidate) => candidate.slug === slug
  )

  if (!post) {
    return {}
  }

  return {
    title: `${post.title} | Verolyx`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article"
    },
    robots: {
      index: true,
      follow: true
    }
  }

}

function formatPublishedDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium"
  }).format(new Date(value))
}

function ContentBlockView({
  block
}: {
  block: ContentBlock
}) {

  if (block.type === "heading") {
    return (
      <h2 className="text-xl font-semibold mt-8">
        {block.text}
      </h2>
    )
  }

  if (block.type === "list") {
    return (
      <ul className="mt-3 space-y-2 list-disc pl-6">
        {block.items.map((item) => (
          <li
            key={item}
            className="text-muted-foreground leading-relaxed"
          >
            {item}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <p className="text-muted-foreground mt-4 leading-relaxed">
      {block.text}
    </p>
  )

}

export default async function BlogPostPage({
  params
}: {
  params: Promise<{ slug: string }>
}) {

  const { slug } = await params

  const post = blogPosts.find(
    (candidate) => candidate.slug === slug
  )

  if (!post) {
    notFound()
  }

  const articleStructuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    author: {
      "@type": "Organization",
      name: "Verolyx"
    }
  }

  return (

    <main className="relative min-h-screen bg-background text-foreground overflow-hidden">

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[image:var(--gradient-glow)]"
      />

      <div className="max-w-3xl mx-auto px-6 py-20">

        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition"
        >
          ← Back to Blog
        </Link>

        <p className="text-muted-foreground text-xs mt-6">
          {formatPublishedDate(post.publishedAt)}
        </p>

        <h1 className="text-3xl md:text-4xl font-bold mt-3">
          {post.title}
        </h1>

        <div className="mt-8">

          {post.content.map((block, index) => (
            <ContentBlockView
              key={index}
              block={block}
            />
          ))}

        </div>

        <Button asChild size="lg" className="mt-10 h-auto py-3 px-8">
          <Link href="/">
            Run a Free Audit
          </Link>
        </Button>

      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(articleStructuredData)
        }}
      />

    </main>

  )

}
