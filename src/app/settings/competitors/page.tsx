import type { Metadata } from "next"
import CompetitorsClient from "./CompetitorsClient"

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false
  }
}

export default function CompetitorsPage() {
  return <CompetitorsClient />
}
