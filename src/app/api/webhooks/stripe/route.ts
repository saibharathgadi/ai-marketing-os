import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { getStripeClient } from "@/lib/stripe/client"
import { createServiceClient } from "@/lib/supabase/service"

/**
 * Stripe webhook handler. No Supabase session exists here -- the
 * request is authenticated by verifying Stripe's signature, not a
 * cookie, and every DB write uses the service-role client. No
 * processed-event dedup table: every write sets columns to the event's
 * current-state values, so a Stripe redelivery is harmless.
 */

// current_period_end lives on each subscription item, not on the
// Subscription object itself, as of this Stripe API version.
function getCurrentPeriodEnd(
  subscription: Stripe.Subscription
): string | null {
  const periodEnd =
    subscription.items.data[0]?.current_period_end

  return periodEnd
    ? new Date(periodEnd * 1000).toISOString()
    : null
}
export async function POST(
  request: Request
) {

  const rawBody = await request.text()
  const signature = request.headers.get("stripe-signature")

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!signature || !webhookSecret) {
    console.error(
      "Stripe webhook missing signature or secret configuration."
    )

    return NextResponse.json(
      {
        success: false,
        error: "Webhook not configured."
      },
      {
        status: 400
      }
    )
  }

  let event: Stripe.Event

  try {

    const stripe = getStripeClient()

    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret
    )

  } catch (error) {

    console.error(
      "Stripe webhook signature verification failed:",
      error
    )

    return NextResponse.json(
      {
        success: false,
        error: "Invalid signature."
      },
      {
        status: 400
      }
    )

  }

  const supabase = createServiceClient()

  try {

    switch (event.type) {

      case "checkout.session.completed": {

        const session =
          event.data.object as Stripe.Checkout.Session

        const orgId = session.client_reference_id

        if (!orgId) {
          console.error(
            "checkout.session.completed missing client_reference_id:",
            session.id
          )

          // Don't let Stripe retry an event we can never resolve.
          return NextResponse.json({ success: true })
        }

        const stripe = getStripeClient()

        const subscription =
          await stripe.subscriptions.retrieve(
            session.subscription as string
          )

        const { error } =
          await supabase
            .from("organizations")
            .update({
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: subscription.id,
              plan: "pro",
              subscription_status: subscription.status,
              trial_ends_at:
                subscription.trial_end
                  ? new Date(
                      subscription.trial_end * 1000
                    ).toISOString()
                  : null,
              current_period_end:
                getCurrentPeriodEnd(subscription),
              plan_updated_at: new Date().toISOString()
            })
            .eq("id", orgId)

        if (error) {
          console.error(
            "Failed to persist checkout.session.completed:",
            error
          )

          return NextResponse.json(
            { success: false },
            { status: 500 }
          )
        }

        break

      }

      case "customer.subscription.updated": {

        const subscription =
          event.data.object as Stripe.Subscription

        const orgId =
          await resolveOrgId(supabase, subscription)

        if (!orgId) {
          console.error(
            "customer.subscription.updated: no matching organization for customer",
            subscription.customer
          )

          return NextResponse.json(
            { success: false },
            { status: 500 }
          )
        }

        const planForStatus =
          subscription.status === "active" ||
          subscription.status === "trialing" ||
          subscription.status === "past_due"
            ? "pro"
            : subscription.status === "incomplete"
              ? undefined
              : "free"

        const { error } =
          await supabase
            .from("organizations")
            .update({
              ...(planForStatus
                ? { plan: planForStatus }
                : {}),
              subscription_status: subscription.status,
              trial_ends_at:
                subscription.trial_end
                  ? new Date(
                      subscription.trial_end * 1000
                    ).toISOString()
                  : null,
              current_period_end:
                getCurrentPeriodEnd(subscription),
              plan_updated_at: new Date().toISOString()
            })
            .eq("id", orgId)

        if (error) {
          console.error(
            "Failed to persist customer.subscription.updated:",
            error
          )

          return NextResponse.json(
            { success: false },
            { status: 500 }
          )
        }

        break

      }

      case "customer.subscription.deleted": {

        const subscription =
          event.data.object as Stripe.Subscription

        const orgId =
          await resolveOrgId(supabase, subscription)

        if (!orgId) {
          console.error(
            "customer.subscription.deleted: no matching organization for customer",
            subscription.customer
          )

          return NextResponse.json(
            { success: false },
            { status: 500 }
          )
        }

        const { error } =
          await supabase
            .from("organizations")
            .update({
              plan: "free",
              subscription_status: "canceled",
              current_period_end: null,
              plan_updated_at: new Date().toISOString()
            })
            .eq("id", orgId)

        if (error) {
          console.error(
            "Failed to persist customer.subscription.deleted:",
            error
          )

          return NextResponse.json(
            { success: false },
            { status: 500 }
          )
        }

        break

      }

      case "invoice.payment_failed": {

        const invoice =
          event.data.object as Stripe.Invoice

        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id

        if (!customerId) {
          break
        }

        const { data: org } =
          await supabase
            .from("organizations")
            .select("id")
            .eq("stripe_customer_id", customerId)
            .maybeSingle()

        if (!org) {
          console.error(
            "invoice.payment_failed: no matching organization for customer",
            customerId
          )

          return NextResponse.json(
            { success: false },
            { status: 500 }
          )
        }

        // Pro access continues through the grace period -- only actual
        // cancellation (subscription.deleted) downgrades the plan.
        const { error } =
          await supabase
            .from("organizations")
            .update({
              subscription_status: "past_due",
              plan_updated_at: new Date().toISOString()
            })
            .eq("id", org.id)

        if (error) {
          console.error(
            "Failed to persist invoice.payment_failed:",
            error
          )

          return NextResponse.json(
            { success: false },
            { status: 500 }
          )
        }

        break

      }

      default:
        break

    }

    return NextResponse.json({ success: true })

  } catch (error) {

    console.error(
      "Stripe webhook handler error:",
      error
    )

    return NextResponse.json(
      { success: false },
      { status: 500 }
    )

  }

}

async function resolveOrgId(
  supabase: ReturnType<typeof createServiceClient>,
  subscription: Stripe.Subscription
): Promise<string | null> {

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id

  if (customerId) {

    const { data: org } =
      await supabase
        .from("organizations")
        .select("id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle()

    if (org) {
      return org.id
    }

  }

  const metadataOrgId =
    subscription.metadata?.org_id

  if (metadataOrgId) {
    console.error(
      "Resolved org via subscription metadata fallback, not stripe_customer_id:",
      subscription.id
    )

    return metadataOrgId
  }

  return null

}
