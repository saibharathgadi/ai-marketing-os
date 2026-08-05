"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ThemeToggle"
import { cn } from "@/lib/utils"

const navLinks = [
  { href: "/", label: "New Audit" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/content", label: "Content Studio" },
  { href: "/campaigns", label: "Campaign Builder" },
  { href: "/blog", label: "Blog" },
  { href: "/settings/billing", label: "Billing" }
]

export default function Navbar() {

  const router = useRouter()
  const pathname = usePathname()
  const [supabase] = useState(createClient)

  // Defaults to "logged out" — the common case for the first paint on
  // the public landing page — and updates once the session check
  // resolves, or immediately on login/logout via onAuthStateChange.
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {

    supabase.auth
      .getUser()
      .then(({ data }) => setUser(data.user))

    const { data: subscription } =
      supabase.auth.onAuthStateChange(
        (_event, session) => {
          setUser(session?.user ?? null)
        }
      )

    return () => {
      subscription.subscription.unsubscribe()
    }

  }, [supabase])

  async function handleLogout() {

    await supabase.auth.signOut()

    router.push("/login")

  }

  if (pathname === "/login") {
    return null
  }

  return (

    <header className="border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-50">

      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">

        <Link
          href={user ? "/dashboard" : "/"}
          className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent"
        >
          Verolyx
        </Link>

        {user ? (

          <nav className="flex items-center gap-6">

            {navLinks.map((link) => (

              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "text-sm transition",
                  pathname === link.href
                    ? "text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {link.label}
              </Link>

            ))}

            <ThemeToggle />

            <Button
              onClick={handleLogout}
              size="sm"
              variant="outline"
            >
              Logout
            </Button>

          </nav>

        ) : (

          <nav className="flex items-center gap-4">

            <Button asChild size="sm">
              <Link href="/">
                Run Audit
              </Link>
            </Button>

            <Link
              href="/blog"
              className={cn(
                "text-sm transition",
                pathname.startsWith("/blog")
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Blog
            </Link>

            <Link
              href="/pricing"
              className={cn(
                "text-sm transition",
                pathname === "/pricing"
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Pricing
            </Link>

            <ThemeToggle />

            <Button asChild size="sm" variant="outline">
              <Link href="/login">
                Login
              </Link>
            </Button>

          </nav>

        )}

      </div>

    </header>

  )

}