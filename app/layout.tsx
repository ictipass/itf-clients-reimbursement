import type { Metadata } from "next";

import { AutoRefresh } from "@/app/AutoRefresh";
import { getAppNameForMode } from "@/lib/domain";
import { getActiveRevenueWorkflowMode, usesInAppRevenueWorkflow } from "@/lib/revenue-workflow";

import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const mode = await getActiveRevenueWorkflowMode();
  return {
    title: getAppNameForMode(mode),
    description: usesInAppRevenueWorkflow(mode)
      ? "ITF employer registration, annual compliance, training, and reimbursement services."
      : "ITF training and reimbursement services for employers registered with ITF.",
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col antialiased">
        <AutoRefresh />
        {children}
      </body>
    </html>
  );
}
