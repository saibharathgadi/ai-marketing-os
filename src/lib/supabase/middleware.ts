import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

const publicPaths = ["/login"]

function isPublicPath(pathname: string) {
  return (
    publicPaths.some(
      (path) => pathname === path
    ) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/run-scheduled-audits") ||
    pathname === "/favicon.ico"
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
    return NextResponse.redirect(
      new URL("/dashboard", request.url)
    )
  }

  return response
}
