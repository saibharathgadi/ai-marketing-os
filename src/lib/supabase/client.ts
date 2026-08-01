import { createBrowserClient } from "@supabase/ssr"

/**
 * Supabase client for "use client" components. Carries the user's
 * session (read from cookies), so RLS policies see auth.uid() correctly
 * instead of only the anon role.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
