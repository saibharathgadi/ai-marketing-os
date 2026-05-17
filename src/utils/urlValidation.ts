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

function isPrivateIpv6(hostname: string) {
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
