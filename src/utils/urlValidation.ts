type WebsiteUrlValidationResult =
  | {
      success: true
      url: string
    }
  | {
      success: false
      error: string
    }

const blockedHostnames = new Set([
  "localhost",
  "0.0.0.0",
  "127.0.0.1",
  "::1"
])

function isPrivateIpv4(hostname: string) {
  const parts =
    hostname
      .split(".")
      .map((part) => Number(part))

  if (
    parts.length !== 4 ||
    parts.some(
      (part) =>
        !Number.isInteger(part) ||
        part < 0 ||
        part > 255
    )
  ) {
    return false
  }

  const [first, second] = parts

  return (
    first === 10 ||
    first === 127 ||
    (first === 172 &&
      second >= 16 &&
      second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254)
  )
}

function expandIpv6Groups(
  hostname: string
): number[] | null {
  const value =
    hostname
      .replace(/^\[/, "")
      .replace(/\]$/, "")
      .toLowerCase()

  if (!value.includes(":")) {
    return null
  }

  const doubleColonIndex =
    value.indexOf("::")

  const headPart =
    doubleColonIndex === -1
      ? value
      : value.slice(0, doubleColonIndex)

  const tailPart =
    doubleColonIndex === -1
      ? null
      : value.slice(doubleColonIndex + 2)

  const parseGroups = (part: string) =>
    part === ""
      ? []
      : part
          .split(":")
          .map((segment) => parseInt(segment, 16))

  const head = parseGroups(headPart)
  const tail =
    tailPart === null ? [] : parseGroups(tailPart)

  if (
    [...head, ...tail].some(
      (group) =>
        !Number.isInteger(group) ||
        group < 0 ||
        group > 0xffff
    )
  ) {
    return null
  }

  if (doubleColonIndex === -1) {
    return head.length === 8 ? head : null
  }

  const fillCount =
    8 - head.length - tail.length

  if (fillCount < 0) {
    return null
  }

  return [
    ...head,
    ...new Array(fillCount).fill(0),
    ...tail
  ]
}

function isPrivateIpv6(hostname: string) {
  const groups = expandIpv6Groups(hostname)

  if (!groups) {
    const normalized =
      hostname
        .replace(/^\[/, "")
        .replace(/\]$/, "")
        .toLowerCase()

    return (
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80:")
    )
  }

  const [g0, g1, g2, g3, g4, g5, g6, g7] =
    groups

  const isUnspecified =
    groups.every((group) => group === 0)

  const isLoopback =
    groups
      .slice(0, 7)
      .every((group) => group === 0) &&
    g7 === 1

  const isUniqueLocal =
    (g0 & 0xfe00) === 0xfc00

  const isLinkLocal =
    (g0 & 0xffc0) === 0xfe80

  const isIpv4Mapped =
    g0 === 0 &&
    g1 === 0 &&
    g2 === 0 &&
    g3 === 0 &&
    g4 === 0 &&
    g5 === 0xffff

  if (isIpv4Mapped) {
    const embeddedIpv4 =
      `${(g6 >> 8) & 0xff}.${g6 & 0xff}.` +
      `${(g7 >> 8) & 0xff}.${g7 & 0xff}`

    return (
      embeddedIpv4 === "0.0.0.0" ||
      isPrivateIpv4(embeddedIpv4)
    )
  }

  return (
    isUnspecified ||
    isLoopback ||
    isUniqueLocal ||
    isLinkLocal
  )
}

export function validateWebsiteUrl(
  value: unknown
): WebsiteUrlValidationResult {
  if (typeof value !== "string") {
    return {
      success: false,
      error: "URL is required."
    }
  }

  const input = value.trim()

  if (!input) {
    return {
      success: false,
      error: "URL is required."
    }
  }

  let parsed: URL

  try {
    parsed = new URL(input)
  } catch {
    return {
      success: false,
      error: "Please enter a valid website URL."
    }
  }

  if (
    parsed.protocol !== "http:" &&
    parsed.protocol !== "https:"
  ) {
    return {
      success: false,
      error:
        "Only HTTP and HTTPS website URLs can be audited."
    }
  }

  if (parsed.username || parsed.password) {
    return {
      success: false,
      error:
        "Website URLs with embedded credentials cannot be audited."
    }
  }

  const hostname =
    parsed.hostname.toLowerCase()

  if (
    blockedHostnames.has(hostname) ||
    hostname.endsWith(".local") ||
    isPrivateIpv4(hostname) ||
    isPrivateIpv6(hostname)
  ) {
    return {
      success: false,
      error:
        "Private, local, and loopback addresses cannot be audited."
    }
  }

  if (
    !hostname.includes(".") &&
    !hostname.includes(":")
  ) {
    return {
      success: false,
      error: "Please enter a valid website URL."
    }
  }

  parsed.hash = ""

  return {
    success: true,
    url: parsed.href
  }
}

const maxSafeRedirects = 5

export class UnsafeRedirectError extends Error {}

/**
 * Wraps fetch() so every redirect hop is re-validated against the same
 * SSRF blocklist as the initial URL. A malicious/compromised site can
 * otherwise 302 a crawler request to an internal address or the cloud
 * metadata endpoint, since fetch's built-in redirect:"follow" never
 * re-checks the target host.
 */
export async function fetchWithSsrfProtection(
  initialUrl: string,
  init?: RequestInit
): Promise<Response> {
  let currentUrl = initialUrl

  for (
    let redirectCount = 0;
    redirectCount <= maxSafeRedirects;
    redirectCount++
  ) {
    const validation =
      validateWebsiteUrl(currentUrl)

    if (!validation.success) {
      throw new UnsafeRedirectError(
        validation.error
      )
    }

    const response = await fetch(
      validation.url,
      {
        ...init,
        redirect: "manual"
      }
    )

    const isRedirect =
      response.status >= 300 &&
      response.status < 400

    const location =
      response.headers.get("location")

    if (!isRedirect || !location) {
      return response
    }

    currentUrl = new URL(
      location,
      validation.url
    ).href
  }

  throw new UnsafeRedirectError(
    "Too many redirects."
  )
}
