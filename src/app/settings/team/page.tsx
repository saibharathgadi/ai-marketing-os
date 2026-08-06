import type { Metadata } from "next"
import TeamSettingsClient from "./TeamSettingsClient"

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false
  }
}

export default function TeamSettingsPage() {
  return <TeamSettingsClient />
}
