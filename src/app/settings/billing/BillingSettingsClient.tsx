"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { formatLocalTimestamp } from "@/lib/date"
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

type OrgBilling = {
  plan: string
  subscription_status: string | null
  trial_ends_at: string | null
  current_period_end: string | null
}

export default function BillingSettingsClient() {

  const searchParams = useSearchParams()
  const [org, setOrg] = useState<OrgBilling | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError, setPortalError] = useState<string | null>(null)

  useEffect(() => {

    // Goes through a server route (getCurrentOrgId) rather than
    // querying Supabase directly from the client: a direct .single()
    // query here has no org_id filter, and RLS alone shows every org a
    // gated multi-org user belongs to, so .single() would error for
    // exactly that user (see /api/billing/route.ts's comment).
    fetch("/api/billing")
      .then((response) => response.json())
      .then((result) => {

        if (!result.success) {
          setLoadError(true)
          return
        }

        setOrg(result.data)

      })
      .catch(() => {
        setLoadError(true)
      })

  }, [])

  async function handleManageBilling() {

    setPortalError(null)
    setPortalLoading(true)

    try {

      const response =
        await fetch(
          "/api/billing/portal",
          { method: "POST" }
        )

      const result = await response.json()

      if (!result.success) {
        setPortalError(
          result.error || "Failed to open billing portal."
        )

        return
      }

      window.location.href = result.data.url

    } catch {

      setPortalError("Failed to open billing portal.")

    } finally {

      setPortalLoading(false)

    }

  }

  const isPro = org?.plan === "pro"
  const checkoutSuccess = searchParams.get("checkout") === "success"

  return (

    <main className="relative min-h-screen bg-background text-foreground">

      <div className="max-w-2xl mx-auto px-6 py-16">

        <h1 className="text-3xl font-bold">
          Billing
        </h1>

        <p className="text-muted-foreground mt-2">
          Manage your Verolyx plan and subscription.
        </p>

        {checkoutSuccess && (
          <p className="mt-4 text-sm text-primary">
            Your subscription is active. Welcome to Pro.
          </p>
        )}

        <Card className="rounded-2xl border border-border bg-card p-6 mt-8">

          <CardHeader>

            <div className="flex items-center gap-3">

              <CardTitle className="text-xl">
                Current plan
              </CardTitle>

              {org && (
                <Badge variant={isPro ? "default" : "secondary"}>
                  {isPro ? "Pro" : "Free"}
                </Badge>
              )}

            </div>

            {org?.subscription_status && (
              <CardDescription>
                Status: {org.subscription_status}
              </CardDescription>
            )}

          </CardHeader>

          <CardContent>

            {loadError && (
              <p className="text-sm text-destructive">
                Failed to load billing information.
              </p>
            )}

            {isPro && org?.trial_ends_at && (
              <p className="text-sm text-muted-foreground">
                Trial ends {formatLocalTimestamp(org.trial_ends_at)}
              </p>
            )}

            {org?.current_period_end && (
              <p className="text-sm text-muted-foreground">
                Renews {formatLocalTimestamp(org.current_period_end)}
              </p>
            )}

            {!isPro && org && (
              <p className="text-sm text-muted-foreground">
                Free plan is limited to 1 monitored website with manual
                audits only.
              </p>
            )}

          </CardContent>

          <CardFooter className="flex flex-col gap-2 items-stretch">

            {isPro ? (

              <Button
                onClick={handleManageBilling}
                disabled={portalLoading}
              >
                {portalLoading
                  ? "Opening billing portal..."
                  : "Manage billing"}
              </Button>

            ) : (

              <Button asChild>
                <Link href="/pricing">
                  Upgrade to Pro
                </Link>
              </Button>

            )}

            {portalError && (
              <p className="text-sm text-destructive">
                {portalError}
              </p>
            )}

          </CardFooter>

        </Card>

      </div>

    </main>

  )

}
