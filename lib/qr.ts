import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

type QrCodeModule = {
  toBuffer: (text: string, options?: Record<string, unknown>) => Promise<Buffer>;
  toString: (text: string, options?: Record<string, unknown>) => Promise<string>;
};

function getQrCodeModule(): QrCodeModule {
  try {
    return require("qrcode") as QrCodeModule;
  } catch {
    throw new Error("QR code support requires the qrcode package. Install it with: npm install qrcode @types/qrcode");
  }
}

export async function renderQrPng(text: string) {
  const qrcode = getQrCodeModule();

  return qrcode.toBuffer(text, {
    errorCorrectionLevel: "M",
    margin: 1,
    type: "png",
    width: 320,
  });
}

export async function renderQrSvg(text: string) {
  const qrcode = getQrCodeModule();

  return qrcode.toString(text, {
    errorCorrectionLevel: "M",
    margin: 1,
    type: "svg",
  });
}

export function getPublicAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/g, "") ||
    process.env.NEXTAUTH_URL?.replace(/\/+$/g, "") ||
    "http://localhost:3000"
  );
}

export function getVerificationUrl(number: string) {
  const url = new URL("/verify", getPublicAppUrl());
  url.searchParams.set("number", number);

  return url.toString();
}
