import type { Metadata } from "next"
import { Suspense } from "react"
import BillingSettingsClient from "./BillingSettingsClient"

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false
  }
}

export default function BillingSettingsPage() {
  return (
    // BillingSettingsClient reads the ?checkout= query param via
    // useSearchParams, which Next.js requires a Suspense boundary for.
    <Suspense fallback={null}>
      <BillingSettingsClient />
    </Suspense>
  )
}
