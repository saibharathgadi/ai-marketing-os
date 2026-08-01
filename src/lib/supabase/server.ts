import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

/**
 * Supabase client for Server Components and Route Handlers. Reads the
 * session from request cookies so RLS policies see auth.uid() correctly.
 *
 * Must be created fresh per request (never module-scoped/singleton) —
 * it's bound to that request's cookies.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Called from a Server Component render, where cookies
            // can't be mutated. Session refresh is handled by
            // middleware.ts instead — safe to ignore here.
          }
        }
      }
    }
  )
}
