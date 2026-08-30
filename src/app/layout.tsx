import type { Metadata } from "next"
import "./globals.css"
import Navbar from "@/components/Navbar"
import { ThemeProvider } from "@/components/ThemeProvider"
import { AppToastProvider } from "@/components/ToastProvider"
import { InlineScript } from "@/components/InlineScript"

export const metadata: Metadata = {
  metadataBase: new URL("https://verolyx.in"),
  title: "Verolyx",
  description:
    "The AI platform for SEO, AEO, GEO, content, and campaigns.",
  alternates: {
    canonical: "/"
  }
}

// Runs before hydration so the correct theme is applied on first paint —
// without this, the page would render the :root (dark) palette and then
// flash to light for a user whose stored preference is light.
const noFlashThemeScript = `
  (function () {
    try {
      var stored = window.localStorage.getItem("theme");
      var theme =
        stored === "light" || stored === "dark"
          ? stored
          : window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
      document.documentElement.dataset.theme = theme;
    } catch (e) {}
  })();
`

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {

  return (

    <html lang="en" suppressHydrationWarning>

      <head>
        <InlineScript html={noFlashThemeScript} />
      </head>

      <body className="bg-background text-foreground" suppressHydrationWarning>

        <ThemeProvider>

          <AppToastProvider>

            <Navbar />

            {children}

          </AppToastProvider>

        </ThemeProvider>

      </body>

    </html>

  )

}
