import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/utils/organizations"
import { getStripeClient } from "@/lib/stripe/client"
import {
  checkRateLimit,
  getRequestKey
} from "@/utils/rateLimit"

export async function POST(
  request: Request
) {

  const rateLimit =
    await checkRateLimit({
      key: getRequestKey(
        request,
        "billing-portal"
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
            String(
              rateLimit.retryAfterSeconds
            )
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

  const { data: org } =
    await supabase
      .from("organizations")
      .select("stripe_customer_id")
      .eq("id", orgId)
      .single()

  if (!org?.stripe_customer_id) {
    return NextResponse.json(
      {
        success: false,
        error: "No billing account found. Upgrade to Pro first."
      },
      {
        status: 400
      }
    )
  }

  const origin = new URL(request.url).origin

  try {

    const stripe = getStripeClient()

    const session =
      await stripe.billingPortal.sessions.create({
        customer: org.stripe_customer_id,
        return_url: `${origin}/settings/billing`
      })

    return NextResponse.json({
      success: true,
      data: {
        url: session.url
      }
    })

  } catch (error) {

    console.error(
      "Failed to create billing portal session:",
      error
    )

    return NextResponse.json(
      {
        success: false,
        error: "Failed to open billing portal."
      },
      {
        status: 500
      }
    )

  }

}
