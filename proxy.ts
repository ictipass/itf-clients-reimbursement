import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

import { canAccessPath } from "@/lib/feature-gates";
import { roles, type Role } from "@/lib/rbac";

const protectedPrefixes = [
  "/dashboard",
  "/registry",
  "/compliance",
  "/training-plans",
  "/training-requests",
  "/training-monitoring",
  "/claims",
  "/management",
  "/employer",
  "/settings",
];

function isProtectedPath(pathname: string) {
  return protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function resolveTokenRole(value: unknown): Role | null {
  return typeof value === "string" && roles.includes(value as Role) ? (value as Role) : null;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  const role = resolveTokenRole(token.role);

  if (token.mustChangePassword === true && pathname !== "/profile") {
    return NextResponse.redirect(
      new URL("/profile?message=Change%20your%20temporary%20password%20to%20continue.", request.url),
    );
  }

  if (!role || !canAccessPath(role, pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/registry/:path*",
    "/compliance/:path*",
    "/training-plans/:path*",
    "/training-requests/:path*",
    "/training-monitoring/:path*",
    "/claims/:path*",
    "/management/:path*",
    "/employer/:path*",
    "/settings/:path*",
  ],
};
