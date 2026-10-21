import { getServerSession } from "next-auth";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { isItfRole } from "@/lib/rbac";
import { getItfTrainingPlanCompanyWhere } from "@/lib/training-plan-access";

export const dynamic = "force-dynamic";

function printable(value: string | null | undefined) {
  return (value || "Not provided").replace(/[^\x20-\x7e]/g, "?");
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ submissionId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return new Response("Authentication is required.", { status: 401 });
  if (!isItfRole(session.user.role)) return new Response("ITF staff access is required.", { status: 403 });

  const { submissionId } = await context.params;
  const companyScope = await getItfTrainingPlanCompanyWhere(session.user.email, session.user.role);
  const submission = await getDb().trainingPlanSubmission.findFirst({
    where: { id: submissionId, recordTier: "HOT", company: companyScope },
    select: {
      year: true,
      company: { select: { legalName: true, itfEmployerNumber: true } },
      documents: {
        where: { kind: "TRAINING_PLAN_DOCUMENT", isActive: true, recordTier: "HOT" },
        select: { id: true },
        take: 1,
      },
      lineItems: {
        orderBy: { rowNumber: "asc" },
        select: {
          rowNumber: true, staffName: true, department: true, gapIdentified: true,
          trainingTitle: true, estimatedCost: true, plannedDate: true, location: true, trainer: true,
        },
      },
    },
  });
  if (!submission || !submission.documents.length || !submission.lineItems.length) {
    return new Response("Training plan was not found.", { status: 404 });
  }

  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [595.28, 841.89];
  let page = pdf.addPage(pageSize);
  let y = 795;
  const write = (label: string, value: string) => {
    const labelWidth = bold.widthOfTextAtSize(label, 9) + 5;
    const available = 503 - labelWidth;
    const words = printable(value).split(" ");
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (regular.widthOfTextAtSize(candidate, 9) <= available) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        line = word;
        while (regular.widthOfTextAtSize(line, 9) > available) {
          let length = line.length - 1;
          while (length > 1 && regular.widthOfTextAtSize(line.slice(0, length), 9) > available) length -= 1;
          lines.push(line.slice(0, length));
          line = line.slice(length);
        }
      }
    }
    lines.push(line);
    for (const [index, text] of lines.entries()) {
      if (y < 45) {
        page = pdf.addPage(pageSize);
        y = 795;
      }
      if (index === 0) page.drawText(label, { x: 46, y, size: 9, font: bold, color: rgb(0.15, 0.15, 0.15) });
      page.drawText(text, { x: 46 + labelWidth, y, size: 9, font: regular });
      y -= 15;
    }
    y -= 2;
  };
  const heading = () => {
    page.drawText("Annual Training Plan", { x: 46, y, size: 19, font: bold, color: rgb(0.5, 0, 0.13) });
    y -= 29;
    write("Company:", submission.company.legalName);
    write("ITF number:", submission.company.itfEmployerNumber ?? "Not provided");
    write("Training year:", String(submission.year));
    y -= 10;
  };
  heading();
  for (const item of submission.lineItems) {
    if (y < 175) {
      page = pdf.addPage(pageSize);
      y = 795;
      heading();
    }
    page.drawLine({ start: { x: 46, y: y + 8 }, end: { x: 549, y: y + 8 }, thickness: 0.5, color: rgb(0.75, 0.75, 0.75) });
    write("Row:", String(item.rowNumber));
    write("Staff:", item.staffName);
    write("Department:", item.department);
    write("Gap identified:", item.gapIdentified);
    write("Training:", item.trainingTitle);
    write("Estimated cost:", `NGN ${Number(item.estimatedCost).toLocaleString("en-NG")}`);
    write("Date:", item.plannedDate ? item.plannedDate.toISOString().slice(0, 10) : "Not provided");
    write("Location:", item.location);
    write("Trainer:", item.trainer);
    y -= 8;
  }

  return new Response(new Uint8Array(await pdf.save()), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="training-plan-${submission.year}.pdf"`,
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
