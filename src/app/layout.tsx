import type { Metadata } from "next"
import "./globals.css"
import Navbar from "@/components/Navbar"

export const metadata: Metadata = {
  title: "AI Marketing OS",
  description:
    "AI-powered SEO auditing platform"
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {

  return (

    <html lang="en">

      <body className="bg-black text-white">

        <Navbar />

        {children}

      </body>

    </html>

  )

}