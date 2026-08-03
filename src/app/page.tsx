import type { Metadata } from "next"
import { Suspense } from "react"
import HomeClient from "./HomeClient"

const title =
  "Verolyx | AI Platform for SEO, AEO, GEO, Content & Campaigns"

const description =
  "Run comprehensive 360-degree digital marketing, SEO, AEO, and GEO audits instantly with Verolyx."

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title,
    description
  },
  robots: {
    index: true,
    follow: true
  }
}

const softwareApplicationStructuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Verolyx",
  description,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Any",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD"
  }
}

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(softwareApplicationStructuredData)
        }}
      />
      {/* HomeClient reads the ?url= query param via useSearchParams,
          which Next.js requires a Suspense boundary for so the rest of
          the route can still prerender. */}
      <Suspense fallback={null}>
        <HomeClient />
      </Suspense>
    </>
  )
}
