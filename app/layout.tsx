import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ITF Reimbursement Gateway",
  description:
    "Enterprise workflow platform for ITF employer registration, training approval, and reimbursement claim governance.",
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
