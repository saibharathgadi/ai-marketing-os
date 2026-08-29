import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import {
  exchangeGoogleAuthCode,
  isValidGoogleProvider
} from "@/utils/googleIntegration"
import { encryptToken } from "@/utils/tokenEncryption"

const OAUTH_NONCE_COOKIE = "google_oauth_nonce"

function redirectToSettings(
  request: Request,
  status: "connected" | "error",
  detail?: string
) {
  const url = new URL("/settings/integrations", request.url)
  url.searchParams.set(status, detail ?? "1")
  return NextResponse.redirect(url)
}

export async function GET(request: Request) {

  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const stateParam = url.searchParams.get("state")
  const oauthError = url.searchParams.get("error")

  if (oauthError) {
    return redirectToSettings(request, "error", "consent_denied")
  }

  if (!code || !stateParam) {
    return redirectToSettings(request, "error", "missing_params")
  }

  let state: { orgId: string; provider: string; nonce: string }

  try {
    state = JSON.parse(
      Buffer.from(stateParam, "base64url").toString("utf8")
    )
  } catch {
    return redirectToSettings(request, "error", "invalid_state")
  }

  if (!isValidGoogleProvider(state.provider)) {
    return redirectToSettings(request, "error", "invalid_provider")
  }

  // CSRF check: the nonce in `state` must match the one this same
  // browser session was given when the flow started. This alone proves
  // "this callback belongs to a flow this browser actually started" —
  // it does NOT yet prove the org named in `state` is one this user is
  // actually a member of, which is checked separately below.
  const cookieNonce = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${OAUTH_NONCE_COOKIE}=`))
    ?.slice(OAUTH_NONCE_COOKIE.length + 1)

  if (!cookieNonce || cookieNonce !== state.nonce) {
    return redirectToSettings(request, "error", "invalid_nonce")
  }

  const supabase = await createClient()

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return redirectToSettings(request, "error", "not_authenticated")
  }

  // Re-verify membership directly rather than trusting the org id
  // carried in `state` — state passes through the browser's address
  // bar during the redirect round trip and isn't itself tamper-proof,
  // so a request whose state names an org this user doesn't actually
  // belong to must fail here, not just be assumed valid.
  const { data: membership } =
    await supabase
      .from("organization_members")
      .select("org_id")
      .eq("org_id", state.orgId)
      .eq("user_id", user.id)
      .maybeSingle()

  if (!membership) {
    return redirectToSettings(request, "error", "not_a_member")
  }

  const redirectUri = new URL(
    "/api/integrations/google/callback",
    request.url
  ).toString()

  try {

    const tokens = await exchangeGoogleAuthCode({
      code,
      redirectUri
    })

    const serviceClient = createServiceClient()

    const { error: upsertError } =
      await serviceClient
        .from("integration_connections")
        .upsert(
          {
            org_id: state.orgId,
            provider: state.provider,
            access_token_encrypted: encryptToken(tokens.access_token),
            refresh_token_encrypted: tokens.refresh_token
              ? encryptToken(tokens.refresh_token)
              : null,
            expires_at: new Date(
              Date.now() + tokens.expires_in * 1000
            ).toISOString(),
            scope: tokens.scope,
            connected_by: user.id,
            updated_at: new Date().toISOString()
          },
          { onConflict: "org_id,provider" }
        )

    if (upsertError) {
      console.error(
        "Failed to persist integration connection:",
        upsertError
      )
      return redirectToSettings(request, "error", "storage_failed")
    }

  } catch (error) {

    console.error("Google OAuth callback failed:", error)
    return redirectToSettings(request, "error", "token_exchange_failed")

  }

  const response = redirectToSettings(request, "connected", state.provider)
  response.cookies.delete(OAUTH_NONCE_COOKIE)

  return response

}
