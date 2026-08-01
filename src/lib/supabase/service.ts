import { createClient as createSupabaseClient } from "@supabase/supabase-js"

/**
 * Service-role Supabase client — bypasses Row Level Security entirely.
 *
 * Only use this from trusted server-side code that has ALREADY verified
 * the requesting user's identity and organization membership (at the
 * API route boundary, before calling into crawler/queue utilities).
 * Never import this from a "use client" component or expose it to the
 * browser — SUPABASE_SERVICE_ROLE_KEY must never reach client code.
 */
export function createServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured."
    )
  }

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}
