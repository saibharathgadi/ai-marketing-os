function hasExplicitTimezone(value: string) {
  return /(?:z|[+-]\d{2}:?\d{2})$/i.test(
    value
  )
}

function normalizeSupabaseTimestamp(
  value: string
) {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return null
  }

  if (hasExplicitTimezone(trimmedValue)) {
    return trimmedValue
  }

  const isoLikeValue =
    trimmedValue.includes("T")
      ? trimmedValue
      : trimmedValue.replace(" ", "T")

  return `${isoLikeValue}Z`
}

export function formatLocalTimestamp(
  value?: string | null
) {
  if (!value) {
    return "Never"
  }

  const normalizedValue =
    normalizeSupabaseTimestamp(value)

  if (!normalizedValue) {
    return "Never"
  }

  const date = new Date(normalizedValue)

  if (Number.isNaN(date.getTime())) {
    return "Invalid date"
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      dateStyle: "medium",
      timeStyle: "short"
    }
  ).format(date)
}
