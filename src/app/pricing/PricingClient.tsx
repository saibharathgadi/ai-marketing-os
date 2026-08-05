"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
} from "@/components/ui/card"
import { PLAN_LIMITS } from "@/utils/planLimits"

type Interval = "monthly" | "annual"

const PRICES = {
  monthly: { amount: "$29", suffix: "/month" },
  annual: { amount: "$290", suffix: "/year" }
}

export default function PricingClient() {

  const [supabase] = useState(createClient)
  const [user, setUser] = useState<User | null>(null)
  const [interval, setInterval] = useState<Interval>("monthly")
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {

    supabase.auth
      .getUser()
      .then(({ data }) => setUser(data.user))

  }, [supabase])

  async function handleUpgrade() {

    setErrorMessage(null)
    setLoading(true)

    try {

      const response =
        await fetch(
          "/api/billing/checkout",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ interval })
          }
        )

      const result = await response.json()

      if (!result.success) {
        setErrorMessage(
          result.error || "Failed to start checkout."
        )

        return
      }

      window.location.href = result.data.url

    } catch {

      setErrorMessage("Failed to start checkout.")

    } finally {

      setLoading(false)

    }

  }

  const price = PRICES[interval]

  return (

    <main className="relative min-h-screen bg-background text-foreground overflow-hidden">

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[image:var(--gradient-glow)]"
      />

      <div className="max-w-5xl mx-auto px-6 py-20">

        <div className="max-w-2xl mx-auto text-center">

          <h1 className="text-4xl md:text-5xl font-bold">
            Pricing
          </h1>

          <p className="text-muted-foreground mt-5 text-lg">
            Start free. Upgrade when you need more websites monitored
            and daily automated audits.
          </p>

          <div className="mt-6 inline-flex items-center gap-1 rounded-full border border-border bg-card p-1">

            <button
              type="button"
              onClick={() => setInterval("monthly")}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                interval === "monthly"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              }`}
            >
              Monthly
            </button>

            <button
              type="button"
              onClick={() => setInterval("annual")}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                interval === "annual"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              }`}
            >
              Annual
            </button>

          </div>

        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">

          <Card className="rounded-2xl border border-border bg-card p-6">

            <CardHeader>

              <CardTitle className="text-2xl">
                Free
              </CardTitle>

              <CardDescription>
                For trying Verolyx out.
              </CardDescription>

            </CardHeader>

            <CardContent>

              <div className="text-4xl font-bold">
                $0
              </div>

              <ul className="mt-6 space-y-3 text-sm text-muted-foreground">

                <li>
                  {PLAN_LIMITS.free.monitoredWebsites} monitored website
                </li>

                <li>Manual audits, run anytime</li>

                <li>Full SEO, AEO, AIO, and GEO scoring</li>

                <li>Content Studio and Campaign Builder included</li>

              </ul>

            </CardContent>

            <CardFooter>

              <Button
                asChild
                variant="outline"
                className="w-full"
              >
                <Link href={user ? "/dashboard" : "/"}>
                  {user ? "Current plan" : "Get started"}
                </Link>
              </Button>

            </CardFooter>

          </Card>

          <Card className="rounded-2xl border border-primary bg-card p-6 relative">

            <Badge className="absolute -top-3 left-6">
              14-day free trial
            </Badge>

            <CardHeader>

              <CardTitle className="text-2xl">
                Pro
              </CardTitle>

              <CardDescription>
                For teams that want daily, unattended monitoring.
              </CardDescription>

            </CardHeader>

            <CardContent>

              <div className="text-4xl font-bold">
                {price.amount}
                <span className="text-base font-normal text-muted-foreground">
                  {price.suffix}
                </span>
              </div>

              <ul className="mt-6 space-y-3 text-sm text-muted-foreground">

                <li>
                  Up to {PLAN_LIMITS.pro.monitoredWebsites} monitored websites
                </li>

                <li>Daily automated audits, no manual work</li>

                <li>Full SEO, AEO, AIO, and GEO scoring</li>

                <li>Content Studio and Campaign Builder included</li>

              </ul>

            </CardContent>

            <CardFooter className="flex flex-col gap-2 items-stretch">

              {user ? (

                <Button
                  onClick={handleUpgrade}
                  disabled={loading}
                  className="w-full"
                >
                  {loading
                    ? "Starting checkout..."
                    : "Upgrade to Pro"}
                </Button>

              ) : (

                <Button asChild className="w-full">
                  <Link href={`/login?next=${encodeURIComponent("/pricing")}`}>
                    Log in to upgrade
                  </Link>
                </Button>

              )}

              {errorMessage && (
                <p className="text-sm text-destructive">
                  {errorMessage}
                </p>
              )}

            </CardFooter>

          </Card>

        </div>

      </div>

    </main>

  )

}
