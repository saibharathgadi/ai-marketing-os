/**
 * Supabase/PostgREST returns a generic "column ... does not exist" (or a
 * stale "schema cache") error when a table is missing a column the app
 * expects — typically because a migration hasn't been applied to this
 * environment yet. Call sites use this to detect that specific case and
 * gracefully fall back to a smaller select/insert payload instead of
 * hard-failing the request.
 */
export function isMissingColumnError(
  message: string,
  columnNames: string[]
) {
  const normalized = message.toLowerCase()

  if (normalized.includes("schema cache")) {
    return true
  }

  return columnNames.some((columnName) =>
    normalized.includes(columnName.toLowerCase())
  )
}
