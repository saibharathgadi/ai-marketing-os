import type { Metadata } from "next"
import KeywordTrackingClient from "./KeywordTrackingClient"

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false
  }
}

export default function KeywordsPage() {
  return <KeywordTrackingClient />
}
