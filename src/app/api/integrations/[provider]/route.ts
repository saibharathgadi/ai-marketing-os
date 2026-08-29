import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { getCurrentOrgId } from "@/utils/organizations"
import {
  isValidGoogleProvider,
  revokeGoogleToken
} from "@/utils/googleIntegration"
import { decryptToken } from "@/utils/tokenEncryption"
import {
  checkRateLimit,
  getRequestKey
} from "@/utils/rateLimit"

export async function DELETE(
  request: Request,
  context: {
    params: Promise<{ provider: string }>
  }
) {

  const rateLimit =
    await checkRateLimit({
      key: getRequestKey(
        request,
        "integrations-disconnect"
      ),
      limit: 20,
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

  const { provider } = await context.params

  if (!isValidGoogleProvider(provider)) {
    return NextResponse.json(
      {
        success: false,
        error: "Unknown integration provider."
      },
      {
        status: 400
      }
    )
  }

  const serviceClient = createServiceClient()

  const { data: connection } =
    await serviceClient
      .from("integration_connections")
      .select("access_token_encrypted, refresh_token_encrypted")
      .eq("org_id", orgId)
      .eq("provider", provider)
      .maybeSingle()

  if (connection) {
    // Best-effort revocation at Google — the local row is removed
    // below regardless of whether this succeeds, so a disconnect can
    // never get stuck on a flaky external call.
    const tokenToRevoke =
      connection.refresh_token_encrypted ??
      connection.access_token_encrypted

    try {
      await revokeGoogleToken(decryptToken(tokenToRevoke))
    } catch (error) {
      console.error("Failed to decrypt/revoke token on disconnect:", error)
    }
  }

  const { error: deleteError } =
    await serviceClient
      .from("integration_connections")
      .delete()
      .eq("org_id", orgId)
      .eq("provider", provider)

  if (deleteError) {
    console.error(
      "Failed to delete integration connection:",
      deleteError
    )
    return NextResponse.json(
      {
        success: false,
        error: "Failed to disconnect integration."
      },
      {
        status: 500
      }
    )
  }

  return NextResponse.json({ success: true })

}
