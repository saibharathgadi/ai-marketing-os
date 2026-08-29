import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto"

// AES-256-GCM: a standard authenticated-encryption cipher (confidentiality
// + tamper detection in one step, via the auth tag) rather than a
// hand-rolled scheme. The key lives only in an environment variable —
// never in the database, never in a column, never derived from anything
// stored alongside the ciphertext it protects.
const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

function getEncryptionKey(): Buffer {
  const raw = process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY

  if (!raw) {
    throw new Error(
      "INTEGRATION_TOKEN_ENCRYPTION_KEY is not set. Generate one with " +
        "`openssl rand -base64 32` and set it as an environment variable " +
        "before connecting any OAuth integration."
    )
  }

  const key = Buffer.from(raw, "base64")

  if (key.length !== 32) {
    throw new Error(
      "INTEGRATION_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes " +
        "(a base64-encoded AES-256 key)."
    )
  }

  return key

}

/**
 * Encrypts a token for storage in integration_connections. Never call
 * this from a "use client" file — the key is only ever available in a
 * server environment, by design.
 */
export function encryptToken(plaintext: string): string {

  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final()
  ])

  const authTag = cipher.getAuthTag()

  // iv || authTag || ciphertext, base64-encoded as one opaque blob.
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64")

}

/**
 * Decrypts a token read from integration_connections. Only ever call
 * this from code running with the service-role client's level of trust
 * — the table itself has no RLS policy granting authenticated/anon
 * roles read access, so in practice this only runs in trusted server
 * code that already reached the row via createServiceClient().
 */
export function decryptToken(encoded: string): string {

  const key = getEncryptionKey()
  const combined = Buffer.from(encoded, "base64")

  const iv = combined.subarray(0, IV_LENGTH)
  const authTag = combined.subarray(
    IV_LENGTH,
    IV_LENGTH + AUTH_TAG_LENGTH
  )
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ])

  return plaintext.toString("utf8")

}
