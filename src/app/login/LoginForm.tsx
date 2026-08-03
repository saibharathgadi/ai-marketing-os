"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-4" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  )
}

export default function LoginForm() {

  const router = useRouter()
  const searchParams = useSearchParams()
  const [supabase] = useState(createClient)

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const [error, setError] = useState(() =>
    searchParams.get("error") === "oauth"
      ? "Google sign-in failed — please try again."
      : ""
  )

  const [notice, setNotice] = useState("")

  const signInWithGoogle = async () => {

    try {

      setLoading(true)
      setError("")
      setNotice("")

      const { error } =
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/auth/callback`
          }
        })

      if (error) {
        setError(error.message)
        setLoading(false)
      }

      // No setLoading(false) on success — the browser navigates away to
      // Google's consent screen next, so there's no "stuck loading" state.

    } catch {

      setError("Something went wrong")
      setLoading(false)

    }

  }

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

      router.push("/dashboard")

    } catch {

      setError("Something went wrong")

    } finally {

      setLoading(false)

    }

  }

  return (

    <main className="relative min-h-screen bg-background text-foreground flex items-center justify-center overflow-hidden">

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

        <Button
          onClick={signInWithGoogle}
          disabled={loading}
          variant="outline"
          size="lg"
          className="mt-8 w-full py-3 h-auto gap-2"
        >
          <GoogleIcon />
          Continue with Google
        </Button>

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
