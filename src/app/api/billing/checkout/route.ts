import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/utils/organizations"
import { getStripeClient } from "@/lib/stripe/client"
import {
  checkRateLimit,
  getRequestKey
} from "@/utils/rateLimit"

const PRICE_IDS = {
  monthly: process.env.STRIPE_PRICE_ID_PRO_MONTHLY,
  annual: process.env.STRIPE_PRICE_ID_PRO_ANNUAL
} as const

export async function POST(
  request: Request
) {

  const rateLimit =
    await checkRateLimit({
      key: getRequestKey(
        request,
        "billing-checkout"
      ),
      limit: 5,
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

  const {
    data: { user }
  } = await supabase.auth.getUser()

  const orgId = await getCurrentOrgId(supabase)

  if (!orgId || !user) {
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

  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      {
        success: false,
        error:
          "Request body must be valid JSON."
      },
      {
        status: 400
      }
    )
  }

  const interval =
    (body as { interval?: unknown }).interval

  if (
    interval !== "monthly" &&
    interval !== "annual"
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "interval must be 'monthly' or 'annual'."
      },
      {
        status: 400
      }
    )
  }

  const priceId = PRICE_IDS[interval]

  if (!priceId) {
    console.error(
      `Stripe price id not configured for interval: ${interval}`
    )

    return NextResponse.json(
      {
        success: false,
        error: "Billing is not configured yet."
      },
      {
        status: 500
      }
    )
  }

  const { data: org } =
    await supabase
      .from("organizations")
      .select("stripe_customer_id")
      .eq("id", orgId)
      .single()

  const origin = new URL(request.url).origin

  try {

    const stripe = getStripeClient()

    const session =
      await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [
          {
            price: priceId,
            quantity: 1
          }
        ],
        ...(org?.stripe_customer_id
          ? { customer: org.stripe_customer_id }
          : { customer_email: user.email }),
        client_reference_id: orgId,
        subscription_data: {
          trial_period_days: 14,
          metadata: {
            org_id: orgId
          }
        },
        success_url: `${origin}/settings/billing?checkout=success`,
        cancel_url: `${origin}/pricing?checkout=cancelled`
      })

    return NextResponse.json({
      success: true,
      data: {
        url: session.url
      }
    })

  } catch (error) {

    console.error(
      "Failed to create checkout session:",
      error
    )

    return NextResponse.json(
      {
        success: false,
        error: "Failed to start checkout."
      },
      {
        status: 500
      }
    )

  }

}
