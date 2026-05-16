export type RegressionHealthStatus =
  | "Improving"
  | "Stable"
  | "Warning"
  | "Critical"

export type RegressionAudit = {
  id?: string
  url?: string
  average_score: number
  total_issues: number
  total_pages: number
  created_at?: string | null
}

export type RegressionPage = {
  issues?: string[] | string | null
}

export type RegressionAlert = {
  type:
    | "regression"
    | "improvement"
    | "stable"
    | "info"
  severity:
    | "critical"
    | "warning"
    | "positive"
    | "neutral"
  message: string
}

export type RegressionAnalysis = {
  status: RegressionHealthStatus
  hasEnoughHistory: boolean
  scoreDelta: number | null
  issueDelta: number | null
  pagesDelta: number | null
  alerts: RegressionAlert[]
  summary: string
}

const warningScoreDrop = 5
const criticalScoreDrop = 15
const warningIssueSpike = 5
const criticalIssueSpike = 15
const warningPageDrop = 1
const criticalPageDropRatio = 0.4

function parseIssues(
  issues: string[] | string | null | undefined
) {
  if (Array.isArray(issues)) {
    return issues
      .map((issue) => issue.trim())
      .filter(Boolean)
  }

  if (!issues) {
    return []
  }

  try {
    const parsed = JSON.parse(issues) as unknown

    if (Array.isArray(parsed)) {
      return parsed
        .map((issue) =>
          String(issue).trim()
        )
        .filter(Boolean)
    }
  } catch {}

  return issues
    .split(",")
    .map((issue) => issue.trim())
    .filter(Boolean)
}

function countIssues(
  pages: RegressionPage[] | undefined
) {
  const counts = new Map<string, number>()

  for (const page of pages || []) {
    for (const issue of parseIssues(page.issues)) {
      counts.set(
        issue,
        (counts.get(issue) || 0) + 1
      )
    }
  }

  return counts
}

function getIssueIncreaseAlerts(
  currentPages: RegressionPage[] | undefined,
  previousPages: RegressionPage[] | undefined
) {
  const currentCounts =
    countIssues(currentPages)
  const previousCounts =
    countIssues(previousPages)

  const alerts: RegressionAlert[] = []

  for (const [issue, currentCount] of currentCounts) {
    const previousCount =
      previousCounts.get(issue) || 0
    const increase =
      currentCount - previousCount

    if (increase >= 2) {
      alerts.push({
        type: "regression",
        severity:
          increase >= 5
            ? "critical"
            : "warning",
        message:
          `${issue} issues increased by ${increase}`
      })
    }
  }

  return alerts.slice(0, 4)
}

function getHighestSeverity(
  alerts: RegressionAlert[]
) {
  if (
    alerts.some(
      (alert) =>
        alert.severity === "critical"
    )
  ) {
    return "critical"
  }

  if (
    alerts.some(
      (alert) =>
        alert.severity === "warning"
    )
  ) {
    return "warning"
  }

  if (
    alerts.some(
      (alert) =>
        alert.severity === "positive"
    )
  ) {
    return "positive"
  }

  return "neutral"
}

function getStatusFromAlerts(
  alerts: RegressionAlert[]
): RegressionHealthStatus {
  const highestSeverity =
    getHighestSeverity(alerts)

  if (highestSeverity === "critical") {
    return "Critical"
  }

  if (highestSeverity === "warning") {
    return "Warning"
  }

  if (highestSeverity === "positive") {
    return "Improving"
  }

  return "Stable"
}

function buildSummary(
  status: RegressionHealthStatus,
  alerts: RegressionAlert[],
  hasEnoughHistory: boolean
) {
  if (!hasEnoughHistory) {
    return "Need at least two audits to detect SEO regressions."
  }

  if (status === "Critical") {
    return "Critical SEO regression detected. Review the highest severity alerts before the next crawl."
  }

  if (status === "Warning") {
    return "SEO warning detected. The latest audit moved in the wrong direction on one or more metrics."
  }

  if (status === "Improving") {
    return "Website health improving consistently compared with the previous audit."
  }

  if (alerts.length === 0) {
    return "Website health is stable compared with the previous audit."
  }

  return alerts[0].message
}

export function getChronologicalRegressionAudits<
  T extends RegressionAudit
>(audits: T[]) {
  return [...audits].sort(
    (a, b) =>
      new Date(a.created_at || "").getTime() -
      new Date(b.created_at || "").getTime()
  )
}

export function analyzeSeoRegression({
  currentAudit,
  previousAudit,
  currentPages,
  previousPages
}: {
  currentAudit?: RegressionAudit | null
  previousAudit?: RegressionAudit | null
  currentPages?: RegressionPage[]
  previousPages?: RegressionPage[]
}): RegressionAnalysis {
  if (!currentAudit || !previousAudit) {
    return {
      status: "Stable",
      hasEnoughHistory: false,
      scoreDelta: null,
      issueDelta: null,
      pagesDelta: null,
      alerts: [
        {
          type: "info",
          severity: "neutral",
          message:
            "Need at least two audits to detect SEO regressions."
        }
      ],
      summary:
        "Need at least two audits to detect SEO regressions."
    }
  }

  const scoreDelta =
    currentAudit.average_score -
    previousAudit.average_score
  const issueDelta =
    currentAudit.total_issues -
    previousAudit.total_issues
  const pagesDelta =
    currentAudit.total_pages -
    previousAudit.total_pages

  const alerts: RegressionAlert[] = []

  if (scoreDelta <= -criticalScoreDrop) {
    alerts.push({
      type: "regression",
      severity: "critical",
      message:
        `SEO score dropped by ${Math.abs(scoreDelta)} points`
    })
  } else if (scoreDelta <= -warningScoreDrop) {
    alerts.push({
      type: "regression",
      severity: "warning",
      message:
        `SEO score dropped by ${Math.abs(scoreDelta)} points`
    })
  } else if (scoreDelta >= warningScoreDrop) {
    alerts.push({
      type: "improvement",
      severity: "positive",
      message:
        `SEO score improved by ${scoreDelta} points`
    })
  }

  if (issueDelta >= criticalIssueSpike) {
    alerts.push({
      type: "regression",
      severity: "critical",
      message:
        `Total SEO issues increased by ${issueDelta}`
    })
  } else if (issueDelta >= warningIssueSpike) {
    alerts.push({
      type: "regression",
      severity: "warning",
      message:
        `Total SEO issues increased by ${issueDelta}`
    })
  } else if (issueDelta <= -warningIssueSpike) {
    alerts.push({
      type: "improvement",
      severity: "positive",
      message:
        `Total SEO issues decreased by ${Math.abs(issueDelta)}`
    })
  }

  const previousPageCount =
    previousAudit.total_pages
  const pageDropRatio =
    previousPageCount > 0
      ? Math.abs(pagesDelta) /
        previousPageCount
      : 0

  if (
    pagesDelta < 0 &&
    pageDropRatio >= criticalPageDropRatio
  ) {
    alerts.push({
      type: "regression",
      severity: "critical",
      message:
        `Pages crawled dropped by ${Math.abs(pagesDelta)}`
    })
  } else if (pagesDelta <= -warningPageDrop) {
    alerts.push({
      type: "regression",
      severity: "warning",
      message:
        `Pages crawled dropped by ${Math.abs(pagesDelta)}`
    })
  } else if (pagesDelta >= warningPageDrop) {
    alerts.push({
      type: "improvement",
      severity: "positive",
      message:
        `Pages crawled increased by ${pagesDelta}`
    })
  }

  alerts.push(
    ...getIssueIncreaseAlerts(
      currentPages,
      previousPages
    )
  )

  if (alerts.length === 0) {
    alerts.push({
      type: "stable",
      severity: "neutral",
      message:
        "No meaningful SEO regression detected."
    })
  }

  const status =
    getStatusFromAlerts(alerts)

  return {
    status,
    hasEnoughHistory: true,
    scoreDelta,
    issueDelta,
    pagesDelta,
    alerts,
    summary: buildSummary(
      status,
      alerts,
      true
    )
  }
}
