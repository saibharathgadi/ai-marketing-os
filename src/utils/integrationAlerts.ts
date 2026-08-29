import {
  escapeHtml,
  getFromEmail,
  resendApiUrl
} from "./emailReport"

/**
 * The entire Phase 1 alerting system: one email, via the Resend
 * integration already wired for team invites, sent when an integration's
 * OAuth token refresh fails. No new service, no new dependency — this
 * exists so a silently-expired GSC/GA4 connection surfaces as a real
 * signal instead of a console.error nobody is watching.
 */
export async function sendIntegrationFailureAlertEmail({
  orgName,
  provider,
  reason
}: {
  orgName: string
  provider: string
  reason: string
}): Promise<void> {

  const apiKey = process.env.RESEND_API_KEY
  const adminEmail = process.env.ADMIN_ALERT_EMAIL

  if (!apiKey || !adminEmail) {
    console.error(
      "Integration failure alert not sent (RESEND_API_KEY or " +
        `ADMIN_ALERT_EMAIL not configured): ${provider} failed for ` +
        `"${orgName}" — ${reason}`
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
          `The connection will need to be reconnected from that workspace's Settings → Integrations page.`,
        tags: [
          {
            name: "category",
            value: "integration-alert"
          }
        ]
      })
    })

  } catch (error) {

    // The alert itself failing shouldn't throw into the caller's own
    // error-handling path — log and move on.
    console.error("Failed to send integration failure alert:", error)

  }

}
