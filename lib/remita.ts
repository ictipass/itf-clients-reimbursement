import { createHash, randomUUID } from "node:crypto";

import { getDb } from "@/lib/db";
import { can, isItfRole, type Role } from "@/lib/rbac";

type RemitaResponse = {
  RRR?: string;
  rrr?: string;
  status?: string;
  statuscode?: string;
  statusCode?: string;
  message?: string;
};

type RemitaConfig = {
  merchantId: string;
  apiKey: string;
  serviceTypeId: string;
  initUrl: string;
  statusUrlTemplate: string;
  paymentUrlTemplate: string;
  authorizationTemplate: string;
  successCodes: string[];
};

export type InitiateRemitaPaymentInput = {
  companyId: string;
  invoiceId: string;
  requesterEmail: string;
  requesterRole: Role;
};

export type ReconcileRemitaPaymentInput = {
  orderId?: string;
  providerReference?: string;
};

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required before Remita payments can be used.`);
  }

  return value;
}

function getRemitaConfig(): RemitaConfig {
  return {
    merchantId: getRequiredEnv("REMITA_MERCHANT_ID"),
    apiKey: getRequiredEnv("REMITA_API_KEY"),
    serviceTypeId: getRequiredEnv("REMITA_SERVICE_TYPE_ID"),
    initUrl: getRequiredEnv("REMITA_PAYMENT_INIT_URL"),
    statusUrlTemplate: getRequiredEnv("REMITA_STATUS_URL_TEMPLATE"),
    paymentUrlTemplate: getRequiredEnv("REMITA_PAYMENT_URL_TEMPLATE"),
    authorizationTemplate: getRequiredEnv("REMITA_AUTHORIZATION_TEMPLATE"),
    successCodes: getRequiredEnv("REMITA_SUCCESS_CODES")
      .split(",")
      .map((code) => code.trim())
      .filter(Boolean),
  };
}

export function isRemitaConfigured() {
  return [
    "REMITA_MERCHANT_ID",
    "REMITA_API_KEY",
    "REMITA_SERVICE_TYPE_ID",
    "REMITA_PAYMENT_INIT_URL",
    "REMITA_STATUS_URL_TEMPLATE",
    "REMITA_PAYMENT_URL_TEMPLATE",
    "REMITA_AUTHORIZATION_TEMPLATE",
    "REMITA_SUCCESS_CODES",
  ].every((name) => Boolean(process.env[name]?.trim()));
}

function sha512(value: string) {
  return createHash("sha512").update(value).digest("hex");
}

function replaceTemplate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, encodeURIComponent(value)),
    template,
  );
}

function parseProviderResponse(body: string): RemitaResponse {
  const trimmed = body.trim();
  const json = trimmed.startsWith("{")
    ? trimmed
    : trimmed.slice(trimmed.indexOf("(") + 1, trimmed.lastIndexOf(")"));

  try {
    return JSON.parse(json) as RemitaResponse;
  } catch {
    throw new Error("Remita returned an unreadable response.");
  }
}

function readStatusCode(response: RemitaResponse) {
  return response.statuscode ?? response.statusCode ?? response.status ?? "";
}

function readStatusMessage(response: RemitaResponse) {
  return response.message ?? response.status ?? "Remita status received.";
}

export async function initiateRemitaPayment(input: InitiateRemitaPaymentInput) {
  if (!can(input.requesterRole, "company:read")) {
    throw new Error("You do not have permission to initiate contribution payments.");
  }

  const config = getRemitaConfig();
  const db = getDb();
  const invoice = await db.contributionInvoice.findFirst({
    where: {
      id: input.invoiceId,
      companyId: input.companyId,
      recordTier: "HOT",
      status: "ISSUED",
    },
    select: {
      id: true,
      companyId: true,
      invoiceNumber: true,
      amount: true,
      company: {
        select: {
          organizationId: true,
          legalName: true,
          email: true,
          telephone: true,
        },
      },
    },
  });

  if (!invoice) {
    throw new Error("An unpaid contribution invoice was not found.");
  }

  const requester = await db.user.findUnique({
    where: {
      email: input.requesterEmail,
    },
    select: {
      id: true,
      name: true,
      phoneNumber: true,
      memberships: {
        where: { isActive: true },
        select: {
          organizationId: true,
        },
      },
    },
  });

  if (!requester) {
    throw new Error("User account was not found.");
  }

  const hasAccess =
    isItfRole(input.requesterRole) ||
    requester.memberships.some(
      (membership) => membership.organizationId === invoice.company.organizationId,
    );

  if (!hasAccess) {
    throw new Error("You do not have access to this contribution invoice.");
  }

  const amount = Number(invoice.amount.toString()).toFixed(2);
  const existing = await db.contributionPayment.findUnique({
    where: {
      invoiceId_provider: {
        invoiceId: invoice.id,
        provider: "REMITA",
      },
    },
    select: {
      id: true,
      status: true,
      orderId: true,
      providerReference: true,
      paymentUrl: true,
    },
  });

  if (existing?.providerReference && existing.paymentUrl && existing.status !== "FAILED") {
    return existing;
  }

  const orderId = existing?.orderId ?? `${invoice.invoiceNumber}-${randomUUID().slice(0, 8)}`;
  const token = sha512(
    `${config.merchantId}${config.serviceTypeId}${orderId}${amount}${config.apiKey}`,
  );
  const authorization = replaceTemplate(config.authorizationTemplate, {
    merchantId: config.merchantId,
    token,
  });
  const response = await fetch(config.initUrl, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      serviceTypeId: config.serviceTypeId,
      amount,
      orderId,
      payerName: invoice.company.legalName,
      payerEmail: invoice.company.email ?? input.requesterEmail,
      payerPhone: invoice.company.telephone ?? requester.phoneNumber ?? "",
      description: `ITF training contribution invoice ${invoice.invoiceNumber}`,
    }),
    cache: "no-store",
  });
  const providerResponse = parseProviderResponse(await response.text());
  const providerReference = providerResponse.RRR ?? providerResponse.rrr;
  const statusCode = readStatusCode(providerResponse);
  const statusMessage = readStatusMessage(providerResponse);

  if (!response.ok || !providerReference) {
    await db.contributionPayment.upsert({
      where: {
        invoiceId_provider: {
          invoiceId: invoice.id,
          provider: "REMITA",
        },
      },
      create: {
        invoiceId: invoice.id,
        companyId: invoice.companyId,
        initiatedById: requester.id,
        orderId,
        amount: invoice.amount,
        status: "FAILED",
        statusCode,
        statusMessage,
      },
      update: {
        status: "FAILED",
        statusCode,
        statusMessage,
        lastCheckedAt: new Date(),
      },
    });
    throw new Error(statusMessage || "Remita could not initiate the payment.");
  }

  const paymentUrl = replaceTemplate(config.paymentUrlTemplate, {
    merchantId: config.merchantId,
    orderId,
    rrr: providerReference,
  });

  return db.contributionPayment.upsert({
    where: {
      invoiceId_provider: {
        invoiceId: invoice.id,
        provider: "REMITA",
      },
    },
    create: {
      invoiceId: invoice.id,
      companyId: invoice.companyId,
      initiatedById: requester.id,
      orderId,
      providerReference,
      amount: invoice.amount,
      status: "PENDING",
      statusCode,
      statusMessage,
      paymentUrl,
      lastCheckedAt: new Date(),
    },
    update: {
      providerReference,
      status: "PENDING",
      statusCode,
      statusMessage,
      paymentUrl,
      lastCheckedAt: new Date(),
    },
    select: {
      id: true,
      status: true,
      orderId: true,
      providerReference: true,
      paymentUrl: true,
    },
  });
}

export async function reconcileRemitaPayment(input: ReconcileRemitaPaymentInput) {
  if (!input.orderId && !input.providerReference) {
    throw new Error("A Remita order ID or RRR is required.");
  }

  const config = getRemitaConfig();
  const db = getDb();
  const payment = await db.contributionPayment.findFirst({
    where: {
      provider: "REMITA",
      recordTier: "HOT",
      ...(input.orderId ? { orderId: input.orderId } : {}),
      ...(input.providerReference ? { providerReference: input.providerReference } : {}),
    },
    select: {
      id: true,
      status: true,
      orderId: true,
      providerReference: true,
      initiatedById: true,
      invoiceId: true,
      companyId: true,
      invoice: {
        select: {
          registrationApplicationId: true,
          company: {
            select: {
              legalName: true,
              organizationId: true,
              areaOfficeId: true,
              organization: {
                select: {
                  workspaceId: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!payment?.providerReference) {
    throw new Error("A Remita payment with an RRR was not found.");
  }

  const hash = sha512(`${payment.providerReference}${config.apiKey}${config.merchantId}`);
  const statusUrl = replaceTemplate(config.statusUrlTemplate, {
    merchantId: config.merchantId,
    orderId: payment.orderId,
    rrr: payment.providerReference,
    hash,
  });
  const response = await fetch(statusUrl, { cache: "no-store" });
  const providerResponse = parseProviderResponse(await response.text());
  const statusCode = readStatusCode(providerResponse);
  const statusMessage = readStatusMessage(providerResponse);
  const successful = response.ok && config.successCodes.includes(statusCode);
  const checkedAt = new Date();

  return db.$transaction(async (tx) => {
    const updated = await tx.contributionPayment.update({
      where: {
        id: payment.id,
      },
      data: {
        status: successful ? "SUCCESSFUL" : "PENDING",
        statusCode,
        statusMessage,
        lastCheckedAt: checkedAt,
        confirmedAt: successful ? checkedAt : undefined,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!successful) {
      return updated;
    }

    if (payment.status === "SUCCESSFUL") {
      return updated;
    }

    await tx.contributionInvoice.update({
      where: {
        id: payment.invoiceId,
      },
      data: {
        status: "PAID",
        paidAt: checkedAt,
      },
    });
    await tx.registrationApplication.update({
      where: {
        id: payment.invoice.registrationApplicationId,
      },
      data: {
        currentDesk: "AREA_MANAGER",
        status: "IN_REVIEW",
      },
    });
    await tx.decision.create({
      data: {
        actorId: payment.initiatedById,
        companyId: payment.companyId,
        registrationApplicationId: payment.invoice.registrationApplicationId,
        action: "SETTLE",
        reason: `Remita confirmed contribution payment with RRR ${payment.providerReference}.`,
      },
    });
    await tx.workItem.upsert({
      where: {
        sourceKey: `registration:${payment.invoice.registrationApplicationId}:remita-payment`,
      },
      create: {
        workspaceId: payment.invoice.company.organization.workspaceId,
        organizationId: payment.invoice.company.organizationId,
        areaOfficeId: payment.invoice.company.areaOfficeId,
        companyId: payment.companyId,
        registrationApplicationId: payment.invoice.registrationApplicationId,
        assignedRole: "AREA_MANAGER",
        app: "REIMBURSEMENT",
        kind: "REGISTRATION_RECEIPT_REVIEW",
        status: "OPEN",
        priority: "HIGH",
        title: "Review confirmed Remita contribution payment",
        summary: `${payment.invoice.company.legalName} has a Remita-confirmed contribution payment ready for Headquarters notification.`,
        targetHref: `/registry/${payment.companyId}`,
        sourceKey: `registration:${payment.invoice.registrationApplicationId}:remita-payment`,
      },
      update: {
        status: "OPEN",
        resolvedAt: null,
        priority: "HIGH",
        title: "Review confirmed Remita contribution payment",
        summary: `${payment.invoice.company.legalName} has a Remita-confirmed contribution payment ready for Headquarters notification.`,
      },
    });

    return updated;
  });
}
