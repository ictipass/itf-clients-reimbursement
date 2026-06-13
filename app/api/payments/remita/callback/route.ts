import { reconcileRemitaPayment } from "@/lib/remita";

export const dynamic = "force-dynamic";

function readValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

async function reconcile(input: { orderId?: string; providerReference?: string }) {
  try {
    const payment = await reconcileRemitaPayment(input);
    return Response.json({ accepted: true, status: payment.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Remita reconciliation failed.";
    return Response.json({ accepted: false, message }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  return reconcile({
    orderId: readValue(url.searchParams.get("orderId")),
    providerReference: readValue(url.searchParams.get("rrr")),
  });
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? ((await request.json()) as Record<string, unknown>)
    : Object.fromEntries(await request.formData());

  return reconcile({
    orderId: readValue(payload.orderId),
    providerReference: readValue(payload.rrr ?? payload.RRR),
  });
}
