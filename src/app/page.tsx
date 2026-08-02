import type { Metadata } from "next"
import HomeClient from "./HomeClient"

const title =
  "AI Marketing OS | Automated SEO, AEO & GEO Audit Platform"

const description =
  "Run comprehensive 360-degree digital marketing, SEO, AEO, and GEO audits instantly with AI Marketing OS."

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
  name: "AI Marketing OS",
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
      <HomeClient />
    </>
  )
}
