import { createTransport, type Transporter } from "nodemailer";
import { ORG_ROLES } from "@/lib/constants/permissions";

/**
 * Email delivery for CargoFlow.
 *
 * Three channels, chosen in this order:
 *  1. SMTP (e.g. Gmail with an app password) when `SMTP_HOST` is configured —
 *     no domain required.
 *  2. Resend when `RESEND_API_KEY` is configured.
 *  3. "Dev mode" — the email is logged to the server console and the caller
 *     can surface a copyable link instead. This keeps the invite flow fully
 *     testable locally without any external service.
 *
 * All senders are best-effort and must never throw — an email hiccup must not
 * break the invitation itself.
 */

const RESEND_URL = "https://api.resend.com/emails";

export type EmailDelivery =
  | { delivered: true; channel: "smtp" | "resend" }
  | { delivered: false; channel: "dev" | "error"; reason?: string };

let smtpTransporter: Transporter | null | undefined;

/**
 * Returns a shared nodemailer transporter when SMTP is configured, otherwise
 * `null`. The transporter is created lazily and cached.
 */
function getSmtpTransporter(): Transporter | null {
  if (smtpTransporter !== undefined) return smtpTransporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD) {
    smtpTransporter = null;
    return null;
  }

  smtpTransporter = createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  });
  return smtpTransporter;
}

/** True when real emails will be sent (SMTP or Resend configured). */
export function isEmailConfigured() {
  return getSmtpTransporter() !== null || Boolean(process.env.RESEND_API_KEY);
}

/** Public base URL of this deployment (client-safe on the server too). */
export function appUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.BETTER_AUTH_URL ??
    "http://localhost:3000"
  );
}

/** The accept page a new member opens after clicking the invitation link. */
export function buildInviteUrl(invitationId: string) {
  return `${appUrl()}/onboarding/accept-invitation?invitationId=${encodeURIComponent(invitationId)}`;
}

function roleLabel(role: string) {
  return ORG_ROLES.find((r) => r.value === role)?.label ?? role;
}

/**
 * Core send. Uses Resend when configured, otherwise logs the message and
 * reports "dev". Never throws.
 */
export async function sendEmail(args: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<EmailDelivery> {
  const smtp = getSmtpTransporter();
  const apiKey = process.env.RESEND_API_KEY;

  if (!smtp && !apiKey) {
    const text = args.text ?? stripTags(args.html);
    console.log(
      `[invite:email-dev] dev mode — no SMTP or RESEND_API_KEY set.\n` +
        `  to: ${args.to}\n` +
        `  subject: ${args.subject}\n` +
        `  body:\n${text.split("\n").map((l) => `    ${l}`).join("\n")}`,
    );
    return { delivered: false, channel: "dev" };
  }

  if (smtp) {
    const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;
    if (!from) {
      return { delivered: false, channel: "error", reason: "SMTP_FROM is not set" };
    }
    try {
      const info = await smtp.sendMail({
        from,
        to: args.to,
        subject: args.subject,
        html: args.html,
        ...(args.text ? { text: args.text } : {}),
      });
      if (info.rejected.length > 0) {
        return {
          delivered: false,
          channel: "error",
          reason: `SMTP rejected: ${info.rejected.join(", ")}`,
        };
      }
      return { delivered: true, channel: "smtp" };
    } catch (err) {
      console.error("[invite:email-error] Failed to send via SMTP:", err);
      return { delivered: false, channel: "error", reason: "SMTP error" };
    }
  }

  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? "CargoFlow <onboarding@resend.dev>",
        to: [args.to],
        subject: args.subject,
        html: args.html,
        ...(args.text ? { text: args.text } : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[invite:email-error] Resend returned ${res.status}: ${body}`);
      return {
        delivered: false,
        channel: "error",
        reason: `Resend returned HTTP ${res.status}`,
      };
    }

    return { delivered: true, channel: "resend" };
  } catch (err) {
    console.error("[invite:email-error] Failed to reach Resend:", err);
    return { delivered: false, channel: "error", reason: "Network error" };
  }
}

/** Builds and sends the "you've been invited" email. */
export async function sendInvitationEmail(args: {
  to: string;
  orgName: string;
  inviterName: string;
  role: string;
  invitationId: string;
}): Promise<EmailDelivery> {
  const url = buildInviteUrl(args.invitationId);
  const role = roleLabel(args.role);
  const subject = `${args.inviterName} invited you to join ${args.orgName} on CargoFlow`;

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f4f4f5;font-family:Segoe UI,Arial,sans-serif;color:#18181b">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;overflow:hidden">
            <tr>
              <td style="background:#18181b;padding:20px 28px">
                <span style="color:#fbbf24;font-size:20px;font-weight:700;letter-spacing:.5px">CARGO<span style="color:#ffffff">FLOW</span></span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 28px">
                <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">You&apos;ve been invited to ${escapeHtml(args.orgName)}</h1>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3f3f46">
                  ${escapeHtml(args.inviterName)} invited you to join
                  <strong>${escapeHtml(args.orgName)}</strong> on CargoFlow as a
                  <strong>${escapeHtml(role)}</strong>.
                </p>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#3f3f46">
                  Click the button below to accept. You&apos;ll need an account with
                  <strong>${escapeHtml(args.to)}</strong>.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto">
                  <tr>
                    <td style="border-radius:8px;background:#18181b">
                      <a href="${url}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none">Accept invitation</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#71717a">
                  Or copy this link into your browser:<br />
                  <a href="${url}" style="color:#2563eb;word-break:break-all">${url}</a>
                </p>
                <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#a1a1aa">
                  This invitation expires in 48 hours. If you weren&apos;t expecting this,
                  you can safely ignore this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `${args.inviterName} invited you to join ${args.orgName} on CargoFlow as ${role}.

Click this link to accept (it expires in 48 hours):
${url}`;

  return sendEmail({ to: args.to, subject, html, text });
}

/** Builds and sends a driver's login PIN, so they can sign into the app. */
export async function sendDriverPinEmail(args: {
  to: string;
  driverName: string;
  orgName: string;
  phone: string;
  pin: string;
}): Promise<EmailDelivery> {
  const subject = `Your CargoFlow driver login PIN`;
  const url = `${appUrl()}/driver`;

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f4f4f5;font-family:Segoe UI,Arial,sans-serif;color:#18181b">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;overflow:hidden">
            <tr>
              <td style="background:#18181b;padding:20px 28px">
                <span style="color:#fbbf24;font-size:20px;font-weight:700;letter-spacing:.5px">CARGO<span style="color:#ffffff">FLOW</span></span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 28px">
                <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">Hi ${escapeHtml(args.driverName)}</h1>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3f3f46">
                  <strong>${escapeHtml(args.orgName)}</strong> has set up your driver account on CargoFlow.
                  Use the phone number and PIN below to sign in.
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e4e4e7;border-radius:10px">
                  <tr>
                    <td style="padding:14px 18px;border-bottom:1px solid #e4e4e7">
                      <span style="font-size:12px;color:#71717a">Phone</span><br/>
                      <span style="font-size:16px;font-weight:600">${escapeHtml(args.phone)}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 18px">
                      <span style="font-size:12px;color:#71717a">Your PIN</span><br/>
                      <span style="font-size:26px;font-weight:700;letter-spacing:4px;color:#18181b">${args.pin}</span>
                    </td>
                  </tr>
                </table>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto 0">
                  <tr>
                    <td style="border-radius:8px;background:#18181b">
                      <a href="${url}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none">Open the driver app</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#71717a">
                  Keep this PIN private. You can change it later from inside the app.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `${args.orgName} has set up your driver account on CargoFlow.

Sign in at ${url} with:
  Phone: ${args.phone}
  PIN:   ${args.pin}

Keep this PIN private. You can change it later from inside the app.`;

  return sendEmail({ to: args.to, subject, html, text });
}

function stripTags(html: string) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}
