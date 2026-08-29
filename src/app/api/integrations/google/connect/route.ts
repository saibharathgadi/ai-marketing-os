import { NextResponse } from "next/server"
import { randomBytes } from "node:crypto"
import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/utils/organizations"
import {
  buildGoogleAuthUrl,
  isValidGoogleProvider
} from "@/utils/googleIntegration"
import {
  checkRateLimit,
  getRequestKey
} from "@/utils/rateLimit"

const OAUTH_NONCE_COOKIE = "google_oauth_nonce"

export async function GET(request: Request) {

  const rateLimit =
    await checkRateLimit({
      key: getRequestKey(
        request,
        "integrations-google-connect"
      ),
      limit: 10,
      windowMs: 60_000
    })

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Too many requests. Please try again shortly.",
        retryAfterSeconds:
          rateLimit.retryAfterSeconds
      },
      {
        status: 429,
        headers: {
          "Retry-After":
            String(rateLimit.retryAfterSeconds)
        }
      }
    )
  }

  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)

  if (!orgId) {
    return NextResponse.json(
      {
        success: false,
        error: "Authentication required."
      },
      {
        status: 401
      }
    )
  }

  const url = new URL(request.url)
  const provider = url.searchParams.get("provider")

  if (!provider || !isValidGoogleProvider(provider)) {
    return NextResponse.json(
      {
        success: false,
        error: "Unknown or missing integration provider."
      },
      {
        status: 400
      }
    )
  }

  // The nonce defends against CSRF (an attacker can't complete their own
  // OAuth flow inside a victim's session, since they can't set the
  // victim's httpOnly cookie). Google's state param carries orgId +
  // provider along for the round trip, but is NOT itself trusted at
  // callback time — the callback re-verifies the current session's user
  // is actually a member of the org named in state before writing
  // anything, so a tampered state value can only ever fail closed.
  const nonce = randomBytes(24).toString("base64url")

  const state = Buffer.from(
    JSON.stringify({ orgId, provider, nonce })
  ).toString("base64url")

  const redirectUri = new URL(
    "/api/integrations/google/callback",
    request.url
  ).toString()

  let authUrl: string

  try {
    authUrl = buildGoogleAuthUrl({ provider, redirectUri, state })
  } catch (error) {
    console.error("Failed to build Google auth URL:", error)
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Google integration is not configured."
      },
      {
        status: 500
      }
    )
  }

  const response = NextResponse.redirect(authUrl)

  response.cookies.set(OAUTH_NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/api/integrations/google/callback"
  })

  return response

}
