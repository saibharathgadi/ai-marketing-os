"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export default function LoginForm() {

  const router = useRouter()
  const [supabase] = useState(createClient)

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

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

    <main className="min-h-screen bg-black text-white flex items-center justify-center">

      <Card className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8">

        <h1 className="text-4xl font-bold">
          Login
        </h1>

        <p className="text-zinc-400 mt-2">
          Access your marketing dashboard.
        </p>

        <div className="mt-8 space-y-4">

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
            className="w-full rounded-xl bg-black border border-zinc-800 px-4 py-3 outline-none focus:border-violet-500"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
            className="w-full rounded-xl bg-black border border-zinc-800 px-4 py-3 outline-none focus:border-violet-500"
          />

        </div>

        {error && (

          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-red-300">

            {error}

          </div>

        )}

        {notice && (

          <div className="mt-4 rounded-xl border border-violet-500/20 bg-violet-500/10 p-3 text-violet-200">

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
