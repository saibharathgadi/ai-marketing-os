import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="relative min-h-screen bg-background text-foreground flex items-center justify-center px-6 py-20 overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[image:var(--gradient-glow)]"
      />

      <section className="max-w-xl text-center">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">
          404
        </p>

        <h1 className="mt-3 text-4xl font-bold">
          Page not found
        </h1>

        <p className="mt-4 text-muted-foreground leading-relaxed">
          The page you are looking for does not exist, or it may have moved.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/">
              Run a free audit
            </Link>
          </Button>

          <Button asChild size="lg" variant="outline">
            <Link href="/blog">
              Read the blog
            </Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
