export type GoogleIntegrationProvider =
  | "google_search_console"
  | "google_analytics"

// Principle of least privilege: each provider requests only the one
// read-only scope it actually needs, not a bundled "all of Google" grant.
const SCOPES: Record<GoogleIntegrationProvider, string> = {
  google_search_console:
    "https://www.googleapis.com/auth/webmasters.readonly",
  google_analytics:
    "https://www.googleapis.com/auth/analytics.readonly"
}

function getClientCredentials() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET are not " +
        "configured. Create an OAuth 2.0 Web application client in Google " +
        "Cloud Console (with the callback URL below registered as an " +
        "authorized redirect URI) before connecting GSC or GA4."
    )
  }

  return { clientId, clientSecret }
}

export function isValidGoogleProvider(
  value: string
): value is GoogleIntegrationProvider {
  return value === "google_search_console" || value === "google_analytics"
}

export function buildGoogleAuthUrl({
  provider,
  redirectUri,
  state
}: {
  provider: GoogleIntegrationProvider
  redirectUri: string
  state: string
}) {
  const { clientId } = getClientCredentials()

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES[provider],
    access_type: "offline",
    // Forces Google to return a refresh_token even if this org
    // previously granted consent — without this, a reconnect after a
    // revoke silently comes back with no refresh_token at all.
    prompt: "consent",
    state
  })

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

type GoogleTokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope: string
  token_type: string
}

export async function exchangeGoogleAuthCode({
  code,
  redirectUri
}: {
  code: string
  redirectUri: string
}): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret } = getClientCredentials()

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    })
  })

  if (!response.ok) {
    // Deliberately not logging the response body — it can echo back
    // request parameters and this is the one code path that's closest
    // to a token value; the status code is enough to diagnose from.
    throw new Error(
      `Google token exchange failed with status ${response.status}.`
    )
  }

  return response.json()
}

export async function refreshGoogleAccessToken(
  refreshToken: string
): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret } = getClientCredentials()

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  })

  if (!response.ok) {
    throw new Error(
      `Google token refresh failed with status ${response.status}.`
    )
  }

  return response.json()
}

export async function revokeGoogleToken(token: string): Promise<void> {
  // Best-effort — the local row is deleted regardless of whether Google's
  // revocation endpoint succeeds, so a disconnect never gets stuck.
  try {
    await fetch(
      `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
      { method: "POST" }
    )
  } catch (error) {
    console.error("Failed to revoke Google token:", error)
  }
}
