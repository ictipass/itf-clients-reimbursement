export type EmailDeliveryMode = "development_link" | "resend" | "resend_and_development_link";

export type TransactionalEmail = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

function getDeliveryMode(): EmailDeliveryMode {
  const configured = process.env.EMAIL_DELIVERY_MODE ?? "development_link";
  if (
    configured !== "development_link" &&
    configured !== "resend" &&
    configured !== "resend_and_development_link"
  ) {
    throw new Error("EMAIL_DELIVERY_MODE must be development_link, resend, or resend_and_development_link.");
  }
  if (process.env.NODE_ENV === "production" && configured !== "resend") {
    throw new Error("Production email delivery must use EMAIL_DELIVERY_MODE=resend.");
  }
  return configured;
}

export function shouldExposeDevelopmentEmailLinks() {
  const mode = getDeliveryMode();
  return mode === "development_link" || mode === "resend_and_development_link";
}

export function getAppBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000")
    .replace(/\/+$/, "");
}

export function escapeEmailHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[character] ?? character;
  });
}

export async function sendTransactionalEmail(email: TransactionalEmail) {
  const mode = getDeliveryMode();
  if (mode === "development_link") {
    return { delivered: false, provider: "development_link" as const };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error("RESEND_API_KEY and EMAIL_FROM are required for Resend delivery.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email.to],
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  });

  const result = (await response.json()) as { id?: string; message?: string };
  if (!response.ok || !result.id) {
    throw new Error(result.message ?? "Resend could not deliver the email.");
  }

  return { delivered: true, provider: "resend" as const, messageId: result.id };
}

function actionEmail(input: {
  recipientName: string;
  heading: string;
  message: string;
  actionLabel: string;
  actionUrl: string;
}) {
  const name = escapeEmailHtml(input.recipientName);
  const heading = escapeEmailHtml(input.heading);
  const message = escapeEmailHtml(input.message);
  const actionLabel = escapeEmailHtml(input.actionLabel);
  const actionUrl = escapeEmailHtml(input.actionUrl);

  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#18181b">
      <p style="color:#800020;font-weight:700">Industrial Training Fund</p>
      <h1 style="font-size:24px">${heading}</h1>
      <p>Hello ${name},</p>
      <p style="line-height:1.6">${message}</p>
      <p style="margin:28px 0">
        <a href="${actionUrl}" style="background:#800020;color:#fff;padding:12px 18px;text-decoration:none;border-radius:6px;font-weight:700">${actionLabel}</a>
      </p>
      <p style="font-size:13px;color:#52525b">If the button does not work, open: ${actionUrl}</p>
    </div>
  `;
}

export async function sendEmployerVerificationEmail(input: {
  to: string;
  name: string;
  token: string;
  next?: string;
}) {
  const params = new URLSearchParams({ token: input.token });
  if (input.next?.startsWith("/")) params.set("next", input.next);
  const actionUrl = `${getAppBaseUrl()}/verify-email/confirm?${params}`;
  return sendTransactionalEmail({
    to: input.to,
    subject: "Verify your ITF Reimbursement Platform account",
    html: actionEmail({
      recipientName: input.name,
      heading: "Verify your portal account",
      message: "Verify your email address to activate your employer portal account.",
      actionLabel: "Verify account",
      actionUrl,
    }),
    text: `Verify your ITF Reimbursement Platform account: ${actionUrl}`,
  });
}

export async function sendOrganizationInvitationEmail(input: {
  to: string;
  organizationName: string;
  token: string;
}) {
  const actionUrl = `${getAppBaseUrl()}/invitations/accept?token=${encodeURIComponent(input.token)}`;
  return sendTransactionalEmail({
    to: input.to,
    subject: `Invitation to manage ${input.organizationName}`,
    html: actionEmail({
      recipientName: input.to,
      heading: "Organization access invitation",
      message: `You have been invited to access ${input.organizationName} on the ITF Reimbursement Platform.`,
      actionLabel: "Review invitation",
      actionUrl,
    }),
    text: `Review your ${input.organizationName} invitation: ${actionUrl}`,
  });
}

export async function sendPasswordResetEmail(input: { to: string; name: string; token: string }) {
  const actionUrl = `${getAppBaseUrl()}/reset-password?token=${encodeURIComponent(input.token)}`;
  return sendTransactionalEmail({
    to: input.to,
    subject: "Reset your ITF Reimbursement Platform password",
    html: actionEmail({
      recipientName: input.name,
      heading: "Reset your password",
      message: "A password reset was requested for your portal account. This link expires in one hour.",
      actionLabel: "Reset password",
      actionUrl,
    }),
    text: `Reset your ITF Reimbursement Platform password: ${actionUrl}`,
  });
}
