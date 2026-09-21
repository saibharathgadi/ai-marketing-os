import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Validates a post-login redirect target is a same-origin relative path
// — prevents an open redirect via a crafted `?next=` value. A leading
// "/" (and not "//") isn't sufficient on its own: `new URL(path, base)`
// normalizes the string before parsing it (for a "special" scheme, a
// leading backslash is treated as "/", and control characters like tab
// are stripped), so e.g. "/\evil.com" starts with "/" here but still
// resolves off-origin once a caller builds a URL from it. Resolving it
// the same way callers do and checking the origin survived closes that
// class of bypass without having to enumerate every dangerous
// character by hand.
export function isSafeRedirectPath(
  path: string | null
): path is string {
  if (
    typeof path !== "string" ||
    !path.startsWith("/") ||
    path.startsWith("//")
  ) {
    return false
  }

  try {
    return new URL(path, "http://localhost").origin === "http://localhost"
  } catch {
    return false
  }
}
