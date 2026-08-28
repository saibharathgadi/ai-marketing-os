import type { Metadata } from "next"
import BrandProfileClient from "./BrandProfileClient"

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false
  }
}

export default function BrandProfilePage() {
  return <BrandProfileClient />
}
