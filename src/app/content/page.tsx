import type { Metadata } from "next"
import ContentStudioClient from "./ContentStudioClient"

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false
  }
}

export default function ContentPage() {
  return <ContentStudioClient />
}
