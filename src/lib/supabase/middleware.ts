import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { isSafeRedirectPath } from "@/lib/utils"

const publicPaths = ["/login", "/"]

function isPublicPath(pathname: string) {
  return (
    publicPaths.some(
      (path) => pathname === path
    ) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/run-scheduled-audits") ||
    // The OAuth callback runs before a session cookie exists, so it must
    // stay reachable without one.
    pathname.startsWith("/auth/") ||
    pathname === "/favicon.ico" ||
    // Anonymous visitors get a capped teaser crawl instead of a 401 —
    // the route itself branches on session presence.
    pathname === "/api/analyze" ||
    // Audit pages render a teaser (org-less) or a "please log in"
    // notice for anonymous visitors instead of redirecting away.
    pathname.startsWith("/audit/") ||
    // Public marketing content, plus the crawler-facing routes that
    // point at it — a bot hitting these must never get redirected to
    // /login.
    pathname.startsWith("/blog") ||
    pathname === "/sitemap.xml" ||
    pathname === "/robots.txt" ||
    // Marketing/SEO surface, needs to be visible before signup.
    pathname === "/pricing" ||
    // Stripe's webhook POST carries no Supabase session cookie; the
    // route verifies the request itself via its signing secret.
    pathname === "/api/webhooks/stripe"
  )
}

/**
 * Refreshes the Supabase session cookie on every request (required for
 * @supabase/ssr's cookie-based auth to keep working across server
 * component renders) and redirects unauthenticated requests away from
 * private pages. Route handlers under /api/* still perform their own
 * auth checks — this only gates full-page navigations plus general API
 * access, and explicitly leaves /api/run-scheduled-audits alone since
 * that route has its own cron-secret auth model.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }

          response = NextResponse.next({
            request
          })

          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        }
      }
    }
  )

  const {
    data: { user }
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  if (!user && !isPublicPath(pathname)) {
    if (pathname.startsWith("/api")) {
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

    const loginUrl = new URL("/login", request.url)

    return NextResponse.redirect(loginUrl)
  }

  if (user && pathname === "/login") {
    const next = request.nextUrl.searchParams.get("next")

    return NextResponse.redirect(
      new URL(
        isSafeRedirectPath(next) ? next : "/dashboard",
        request.url
      )
    )
  }

  return response
}
