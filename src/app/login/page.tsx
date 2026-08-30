import type { Metadata } from "next"
import { Suspense } from "react"
import LoginForm from "./LoginForm"

export const metadata: Metadata = {
  title: "Login | Verolyx",
  description: "Log in to your Verolyx marketing dashboard.",
  robots: {
    index: false,
    follow: false
  }
}

export default function LoginPage() {
  return (
    // LoginForm reads the ?error= query param via useSearchParams, which
    // Next.js requires a Suspense boundary for so the rest of the route
    // can still prerender instead of the whole page falling back to
    // client-side rendering.
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
