"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function LoginPage() {

  const router = useRouter()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const signUp = async () => {

    try {

      setLoading(true)
      setError("")

      const { error } =
        await supabase.auth.signUp({
          email,
          password
        })

      if (error) {
        setError(error.message)
        return
      }

      alert("Account created successfully")

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

      const { error } =
        await supabase.auth.signInWithPassword({
          email,
          password
        })

      if (error) {
        setError(error.message)
        return
      }

      router.push("/")

    } catch {

      setError("Something went wrong")

    } finally {

      setLoading(false)

    }

  }

  return (

    <main className="min-h-screen bg-black text-white flex items-center justify-center">

      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8">

        <h1 className="text-4xl font-bold">
          Login
        </h1>

        <p className="text-zinc-400 mt-2">
          Access your SEO dashboard.
        </p>

        <div className="mt-8 space-y-4">

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
            className="w-full rounded-xl bg-black border border-zinc-800 px-4 py-3"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
            className="w-full rounded-xl bg-black border border-zinc-800 px-4 py-3"
          />

        </div>

        {error && (

          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-red-300">

            {error}

          </div>

        )}

        <div className="mt-6 flex gap-4">

          <button
            onClick={signIn}
            disabled={loading}
            className="flex-1 rounded-xl bg-white text-black py-3 font-semibold"
          >
            Login
          </button>

          <button
            onClick={signUp}
            disabled={loading}
            className="flex-1 rounded-xl border border-zinc-700 py-3"
          >
            Sign Up
          </button>

        </div>

      </div>

    </main>

  )
}
