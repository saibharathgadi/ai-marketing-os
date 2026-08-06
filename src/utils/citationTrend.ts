export type CitationTrendStatus =
  | "Gained"
  | "Lost"
  | "Stable"
  | "NeverCited"

export type CitationCheck = {
  was_cited: boolean
  created_at?: string | null
}

export type CitationTrendAnalysis = {
  status: CitationTrendStatus
  hasEnoughHistory: boolean
  summary: string
}

export function analyzeCitationTrend({
  currentCheck,
  previousCheck
}: {
  currentCheck?: CitationCheck | null
  previousCheck?: CitationCheck | null
}): CitationTrendAnalysis {

  if (!currentCheck) {
    return {
      status: "NeverCited",
      hasEnoughHistory: false,
      summary: "No checks yet."
    }
  }

  if (!previousCheck) {
    return {
      status: currentCheck.was_cited ? "Stable" : "NeverCited",
      hasEnoughHistory: false,
      summary:
        currentCheck.was_cited
          ? "Currently cited. Need another check to detect a trend."
          : "Not currently cited. Need another check to detect a trend."
    }
  }

  if (currentCheck.was_cited && !previousCheck.was_cited) {
    return {
      status: "Gained",
      hasEnoughHistory: true,
      summary: "Newly cited since the last check."
    }
  }

  if (!currentCheck.was_cited && previousCheck.was_cited) {
    return {
      status: "Lost",
      hasEnoughHistory: true,
      summary: "No longer cited as of the last check."
    }
  }

  return {
    status: currentCheck.was_cited ? "Stable" : "NeverCited",
    hasEnoughHistory: true,
    summary:
      currentCheck.was_cited
        ? "Still cited, no change since the last check."
        : "Still not cited, no change since the last check."
  }

}
