import {
  escapeHtml,
  getFromEmail,
  resendApiUrl
} from "./emailReport"

/**
 * The entire Phase 1 alerting system: one email, via the Resend
 * integration already wired for team invites, sent for two events —
 * an integration's OAuth token refresh failing, or an `internal`-plan
 * org's usage spiking past the alert threshold in src/utils/rateLimit.ts.
 * No new service, no new dependency — this exists so both cases surface
 * as a real signal instead of a console.error nobody is watching.
 */
async function sendAlertEmail({
  subject,
  html,
  text
}: {
  subject: string
  html: string
  text: string
}): Promise<void> {

  const apiKey = process.env.RESEND_API_KEY
  const adminEmail = process.env.ADMIN_ALERT_EMAIL

  if (!apiKey || !adminEmail) {
    console.error(
      "Alert email not sent (RESEND_API_KEY or ADMIN_ALERT_EMAIL not " +
        `configured): ${subject}`
    )
    return
  }

  try {

    await fetch(resendApiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: getFromEmail(),
        to: [adminEmail],
        subject,
        html,
        text,
        tags: [
          {
            name: "category",
            value: "ops-alert"
          }
        ]
      })
    })

  } catch (error) {

    // The alert itself failing shouldn't throw into the caller's own
    // error-handling path — log and move on.
    console.error("Failed to send alert email:", error)

  }

}

export async function sendIntegrationFailureAlertEmail({
  orgName,
  provider,
  reason
}: {
  orgName: string
  provider: string
  reason: string
}): Promise<void> {

  await sendAlertEmail({
    subject: `Integration failure: ${provider} (${orgName})`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.6;">
        <p><strong>Workspace:</strong> ${escapeHtml(orgName)}</p>
        <p><strong>Provider:</strong> ${escapeHtml(provider)}</p>
        <p><strong>Reason:</strong> ${escapeHtml(reason)}</p>
        <p>The connection will need to be reconnected from that workspace's Settings → Integrations page.</p>
      </div>
    `,
    text:
      `Integration failure\n\n` +
      `Workspace: ${orgName}\n` +
      `Provider: ${provider}\n` +
      `Reason: ${reason}\n\n` +
      `The connection will need to be reconnected from that workspace's Settings → Integrations page.`
  })

}

export async function sendUsageSpikeAlertEmail({
  orgName,
  resource,
  count
}: {
  orgName: string
  resource: string
  count: number
}): Promise<void> {

  await sendAlertEmail({
    subject: `Usage spike on internal plan: ${orgName}`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.6;">
        <p><strong>Workspace:</strong> ${escapeHtml(orgName)} (plan: internal)</p>
        <p><strong>Resource:</strong> ${escapeHtml(resource)}</p>
        <p><strong>Count today:</strong> ${count}</p>
        <p>This crossed the internal-plan alert threshold — worth a quick check for a runaway loop or unexpected usage before it becomes a real cost.</p>
      </div>
    `,
    text:
      `Usage spike on internal plan\n\n` +
      `Workspace: ${orgName} (plan: internal)\n` +
      `Resource: ${resource}\n` +
      `Count today: ${count}\n\n` +
      `This crossed the internal-plan alert threshold — worth a quick check for a runaway loop or unexpected usage before it becomes a real cost.`
  })

}
