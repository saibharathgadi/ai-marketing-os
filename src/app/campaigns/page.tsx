import type { Metadata } from "next"
import CampaignBuilderClient from "./CampaignBuilderClient"

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false
  }
}

export default function CampaignsPage() {
  return <CampaignBuilderClient />
}
