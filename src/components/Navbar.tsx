"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from "@/components/ui/dropdown-menu"
import { ThemeToggle } from "@/components/ThemeToggle"
import { cn } from "@/lib/utils"
import { ChevronDownIcon } from "lucide-react"

const navLinks = [
  { href: "/", label: "New Audit" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/content", label: "Content Studio" },
  { href: "/campaigns", label: "Campaign Builder" },
  { href: "/keywords", label: "Keyword Tracking" },
  { href: "/blog", label: "Blog" }
]

// Account-configuration pages, grouped under a "Settings" dropdown rather
// than sitting at the same visual weight as the daily-use tools above —
// these were previously flat top-level links, which made the nav read as
// 9 items with no hierarchy.
const settingsLinks = [
  { href: "/settings/brand", label: "Brand" },
  { href: "/settings/team", label: "Team" },
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

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "flex items-center gap-1 text-sm transition",
                    settingsLinks.some((link) => pathname === link.href)
                      ? "text-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Settings
                  <ChevronDownIcon className="size-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {settingsLinks.map((link) => (
                  <DropdownMenuItem key={link.href} asChild>
                    <Link href={link.href}>{link.label}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

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