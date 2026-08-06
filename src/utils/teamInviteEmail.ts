import {
  escapeHtml,
  getFromEmail,
  resendApiUrl,
  validateReportRecipient
} from "./emailReport"

type SendTeamInviteEmailInput = {
  to: string
  orgName: string
  inviterEmail: string
}

type SendTeamInviteEmailResult = {
  success: boolean
  emailId?: string
  error?: string
}

function buildInviteHtml(
  orgName: string,
  inviterEmail: string,
  loginUrl: string
) {
  return `
    <div style="background:#09090b;padding:32px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <div style="max-width:480px;margin:0 auto;background:#111217;border:1px solid #2f333d;border-radius:16px;padding:32px;color:#e4e4e7;">
        <p style="font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:#a1a1aa;margin:0 0 16px;">
          VEROLYX
        </p>
        <h1 style="font-size:20px;margin:0 0 16px;color:#fafafa;">
          You've been invited to join ${escapeHtml(orgName)}
        </h1>
        <p style="font-size:14px;line-height:1.6;color:#d4d4d8;margin:0 0 24px;">
          ${escapeHtml(inviterEmail)} invited you to join their team on
          Verolyx. Sign up with this email address and you'll be added
          to their organization automatically.
        </p>
        <a
          href="${loginUrl}"
          style="display:inline-block;background:#60a5fa;color:#09090b;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:10px;"
        >
          Accept invite
        </a>
        <p style="font-size:12px;line-height:1.6;color:#71717a;margin:24px 0 0;">
          This invite expires in 7 days. If you weren't expecting this,
          you can ignore this email.
        </p>
      </div>
    </div>
  `
}

function buildInviteText(
  orgName: string,
  inviterEmail: string,
  loginUrl: string
) {
  return (
    `You've been invited to join ${orgName} on Verolyx.\n\n` +
    `${inviterEmail} invited you to join their team. Sign up with ` +
    `this email address and you'll be added to their organization ` +
    `automatically.\n\n` +
    `Accept invite: ${loginUrl}\n\n` +
    `This invite expires in 7 days. If you weren't expecting this, ` +
    `you can ignore this email.`
  )
}

export async function sendTeamInviteEmail({
  to,
  orgName,
  inviterEmail
}: SendTeamInviteEmailInput): Promise<SendTeamInviteEmailResult> {

  if (!validateReportRecipient(to)) {
    return {
      success: false,
      error: "A valid recipient email is required."
    }
  }

  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    return {
      success: false,
      error: "RESEND_API_KEY is not configured."
    }
  }

  const loginUrl = "https://verolyx.in/login"

  try {

    const response = await fetch(resendApiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: getFromEmail(),
        to: [to],
        subject: `You've been invited to join ${orgName} on Verolyx`,
        html: buildInviteHtml(orgName, inviterEmail, loginUrl),
        text: buildInviteText(orgName, inviterEmail, loginUrl),
        tags: [
          {
            name: "category",
            value: "team-invite"
          }
        ]
      })
    })

    const result =
      (await response.json().catch(() => null)) as
        | { id?: string }
        | { message?: string }
        | null

    if (!response.ok) {
      const message =
        result && "message" in result && result.message
          ? result.message
          : "Failed to send invite email."

      return {
        success: false,
        error: message
      }
    }

    return {
      success: true,
      emailId:
        result && "id" in result ? result.id : undefined
    }

  } catch (error) {

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to send invite email."
    }

  }

}
