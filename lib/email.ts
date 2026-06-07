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
