import Stripe from "stripe"

/**
 * Server-only Stripe client. Never import from a "use client" component --
 * STRIPE_SECRET_KEY must never reach the browser. Hosted Checkout and
 * the Customer Portal mean there's no client-side Stripe.js anywhere
 * in this app.
 */
export function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY

  if (!secretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY is not configured."
    )
  }

  return new Stripe(secretKey)
}
