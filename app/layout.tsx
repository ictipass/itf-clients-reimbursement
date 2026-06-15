import type { Metadata } from "next";

import { appName } from "@/lib/domain";

import "./globals.css";

export const metadata: Metadata = {
  title: appName,
  description:
    "Integrated platform for ITF employer registration, contribution assessment and payment, compliance, training approval, monitoring, and reimbursement claims.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col antialiased">{children}</body>
    </html>
  );
}
