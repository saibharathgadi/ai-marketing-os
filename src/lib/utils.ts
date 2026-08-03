import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Validates a post-login redirect target is a same-origin relative path
// (must start with "/" and not "//", which browsers treat as
// protocol-relative and would redirect off-site) — prevents an open
// redirect via a crafted `?next=` value.
export function isSafeRedirectPath(
  path: string | null
): path is string {
  return (
    typeof path === "string" &&
    path.startsWith("/") &&
    !path.startsWith("//")
  )
}
