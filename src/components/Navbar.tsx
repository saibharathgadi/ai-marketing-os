"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ThemeToggle"
import { cn } from "@/lib/utils"

const navLinks = [
  { href: "/", label: "New Audit" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/content", label: "Content Studio" },
  { href: "/campaigns", label: "Campaign Builder" }
]

export default function Navbar() {

  const router = useRouter()
  const pathname = usePathname()
  const [supabase] = useState(createClient)

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
          href="/dashboard"
          className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent"
        >
          AI Marketing OS
        </Link>

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

      </div>

    </header>

  )

}