"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function Navbar() {

  const router = useRouter()

  async function handleLogout() {

    await supabase.auth.signOut()

    router.push("/login")

  }

  return (

    <header className="border-b border-zinc-800 bg-black/80 backdrop-blur-xl sticky top-0 z-50">

      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">

        <Link
          href="/"
          className="text-xl font-bold"
        >
          AI Marketing OS
        </Link>

        <nav className="flex items-center gap-6">

          <Link
            href="/"
            className="text-zinc-300 hover:text-white transition"
          >
            Audit Website
          </Link>

          <Link
            href="/dashboard"
            className="text-zinc-300 hover:text-white transition"
          >
            Dashboard
          </Link>

          <button
            onClick={handleLogout}
            className="rounded-lg bg-white text-black px-4 py-2 text-sm font-semibold"
          >
            Logout
          </button>

        </nav>

      </div>

    </header>

  )

}