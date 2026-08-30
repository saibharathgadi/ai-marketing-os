import type { Metadata } from "next"
import PricingClient from "./PricingClient"

const title = "Pricing | Verolyx"

const description =
  "Simple pricing for AI-ready SEO audits. Start free, upgrade to Pro for more monitored websites and daily automated audits, with a 14-day free trial."

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/pricing"
  },
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

export default function PricingPage() {
  return <PricingClient />
}
