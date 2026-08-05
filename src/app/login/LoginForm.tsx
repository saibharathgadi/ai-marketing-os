"use client"

import { useEffect, useRef, useState } from "react"
import Script from "next/script"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useTheme } from "@/components/ThemeProvider"
import { isSafeRedirectPath } from "@/lib/utils"

type GoogleCredentialResponse = {
  credential: string
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: GoogleCredentialResponse) => void
            nonce: string
          }) => void
          renderButton: (
            parent: HTMLElement,
            options: {
              theme: "outline" | "filled_black"
              size: "large"
              width: number
            }
          ) => void
        }
      }
    }
  }
}

// Supabase's documented pairing for signInWithIdToken: the *hashed*
// nonce goes to Google (embedded in the returned JWT), the *raw* nonce
// goes to Supabase (which re-hashes it to verify the token wasn't
// captured and replayed).
async function generateNonce() {
  const raw = crypto.randomUUID()

  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(raw)
    )

  const hashed =
    Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")

  return { raw, hashed }
}

export default function LoginForm() {

  const router = useRouter()
  const searchParams = useSearchParams()
  const [supabase] = useState(createClient)
  const { theme } = useTheme()

  const googleButtonRef = useRef<HTMLDivElement>(null)
  const rawNonceRef = useRef<string>("")

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const [error, setError] = useState(() =>
    searchParams.get("error") === "oauth"
      ? "Google sign-in failed — please try again."
      : ""
  )

  const [notice, setNotice] = useState("")

  const nextParam = searchParams.get("next")

  const redirectTarget = isSafeRedirectPath(nextParam)
    ? nextParam
    : "/dashboard"

  async function handleGoogleCredential(
    response: GoogleCredentialResponse
  ) {

    try {

      setError("")

      const { error } =
        await supabase.auth.signInWithIdToken({
          provider: "google",
          token: response.credential,
          nonce: rawNonceRef.current
        })

      if (error) {
        setError(error.message)
        return
      }

      router.push(redirectTarget)

    } catch {

      setError("Google sign-in failed — please try again.")

    }

  }

  async function initializeGoogleSignIn() {

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

    if (!clientId || !window.google || !googleButtonRef.current) {
      return
    }

    const { raw, hashed } = await generateNonce()
    rawNonceRef.current = raw

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleGoogleCredential,
      nonce: hashed
    })

    window.google.accounts.id.renderButton(
      googleButtonRef.current,
      {
        theme: theme === "dark" ? "filled_black" : "outline",
        size: "large",
        width: 368
      }
    )

  }

  useEffect(() => {

    if (window.google) {
      initializeGoogleSignIn()
    }

    // Re-render the button if the user toggles theme after the script
    // has already loaded once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme])

  const signUp = async () => {

    try {

      setLoading(true)
      setError("")
      setNotice("")

      const { error } =
        await supabase.auth.signUp({
          email,
          password
        })

      if (error) {
        setError(error.message)
        return
      }

      setNotice(
        "Account created — check your email to confirm, then log in."
      )

    } catch {

      setError("Something went wrong")

    } finally {

      setLoading(false)

    }

  }

  const signIn = async () => {

    try {

      setLoading(true)
      setError("")
      setNotice("")

      const { error } =
        await supabase.auth.signInWithPassword({
          email,
          password
        })

      if (error) {
        setError(error.message)
        return
      }

      router.push(redirectTarget)

    } catch {

      setError("Something went wrong")

    } finally {

      setLoading(false)

    }

  }

  return (

    <main className="relative min-h-screen bg-background text-foreground flex items-center justify-center overflow-hidden">

      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={initializeGoogleSignIn}
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[image:var(--gradient-glow)]"
      />

      <Card className="w-full max-w-md rounded-2xl border border-border bg-card p-8">

        <h1 className="text-4xl font-bold">
          Login
        </h1>

        <p className="text-muted-foreground mt-2">
          Access your marketing dashboard.
        </p>

        <div ref={googleButtonRef} className="mt-8 flex justify-center" />

        <div className="mt-6 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          or continue with email
          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="mt-6 space-y-4">

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
            className="w-full rounded-xl bg-background border border-border px-4 py-3 outline-none focus:border-violet-500"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
            className="w-full rounded-xl bg-background border border-border px-4 py-3 outline-none focus:border-violet-500"
          />

        </div>

        {error && (

          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-red-700 dark:text-red-300">

            {error}

          </div>

        )}

        {notice && (

          <div className="mt-4 rounded-xl border border-violet-500/20 bg-violet-500/10 p-3 text-violet-700 dark:text-violet-300">

            {notice}

          </div>

        )}

        <div className="mt-6 flex gap-4">

          <Button
            onClick={signIn}
            disabled={loading}
            size="lg"
            className="flex-1 py-3 h-auto"
          >
            Login
          </Button>

          <Button
            onClick={signUp}
            disabled={loading}
            variant="outline"
            size="lg"
            className="flex-1 py-3 h-auto"
          >
            Sign Up
          </Button>

        </div>

      </Card>

    </main>

  )
}
