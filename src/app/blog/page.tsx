import type { Metadata } from "next"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { blogPosts } from "@/content/blogPosts"

const title = "Blog | Verolyx"

const description =
  "Plain-language explainers on AEO, GEO, AIO, and technical SEO, and how AI search is changing how sites get found."

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    type: "website"
  },
  robots: {
    index: true,
    follow: true
  }
}

function formatPublishedDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium"
  }).format(new Date(value))
}

export default function BlogIndexPage() {
  return (

    <main className="relative min-h-screen bg-background text-foreground overflow-hidden">

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[image:var(--gradient-glow)]"
      />

      <div className="max-w-5xl mx-auto px-6 py-20">

        <div className="max-w-3xl mx-auto text-center">

          <h1 className="text-4xl md:text-5xl font-bold">
            Blog
          </h1>

          <p className="text-muted-foreground mt-5 text-lg">
            Plain-language explainers on AEO, GEO, AIO, and technical
            SEO, and how AI search is changing how sites get found.
          </p>

        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-6">

          {blogPosts.map((post) => (

            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
            >

              <Card className="h-full rounded-2xl border border-border bg-card p-6 transition hover:border-primary">

                <p className="text-muted-foreground text-xs">
                  {formatPublishedDate(post.publishedAt)}
                </p>

                <h2 className="text-xl font-semibold mt-3">
                  {post.title}
                </h2>

                <p className="text-muted-foreground mt-2 leading-relaxed">
                  {post.description}
                </p>

              </Card>

            </Link>

          ))}

        </div>

      </div>

    </main>

  )
}
