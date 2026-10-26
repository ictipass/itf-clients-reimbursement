import type { Metadata } from "next";

import { AutoRefresh } from "@/app/AutoRefresh";

import "./globals.css";

export const metadata: Metadata = {
  title: "ITF Training and Reimbursement Platform",
  description: "ITF employer training and reimbursement services.",
};

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
