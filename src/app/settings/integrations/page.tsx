import type { Metadata } from "next"
import { Suspense } from "react"
import IntegrationsClient from "./IntegrationsClient"

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false
  }
}

export default function IntegrationsPage() {
  return (
    // IntegrationsClient reads the ?connected=/?error= query params via
    // useSearchParams, which Next.js requires a Suspense boundary for so
    // the rest of the route can still prerender.
    <Suspense fallback={null}>
      <IntegrationsClient />
    </Suspense>
  )
}
