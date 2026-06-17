import type { NextAuthOptions, User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

import { writeIdentitySecurityAuditEvent } from "@/lib/audit";
import { requiresApplicationPasswordChange } from "@/lib/authentication-policy";
import { getDb } from "@/lib/db";
import { authenticateLocalAccount, provisionVerifiedGoogleEmployer } from "@/lib/employer-accounts";
import { checkRateLimit, RateLimitError } from "@/lib/rate-limit";
import type { Role } from "@/lib/rbac";

async function getAuthorizedDirectoryUser(email: string) {
  const user = await getDb().user.findUnique({
    where: { email: email.toLowerCase() },
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      mustChangePassword: true,
      authenticationSource: true,
      memberships: { where: { isActive: true }, select: { role: true }, take: 1 },
    },
  });

  if (!user?.isActive || !user.memberships[0]) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.memberships[0].role,
    mustChangePassword: requiresApplicationPasswordChange(
      user.authenticationSource,
      user.mustChangePassword,
    ),
  };
}

export function getConfiguredOAuthProviders() {
  return [
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? { id: "google", name: "Google" }
      : null,
  ].filter((provider): provider is { id: string; name: string } => Boolean(provider));
}

const oauthProviders = [
  ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? [GoogleProvider({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET })]
    : []),
];

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 8,
    updateAge: 60 * 60,
  },
  jwt: {
    maxAge: 60 * 60 * 8,
  },
  pages: {
    signIn: "/sign-in",
  },
  providers: [
    CredentialsProvider({
      name: "Portal Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase();
        const password = credentials?.password;

        if (email) {
          const rateLimit = await checkRateLimit({
            key: `auth:${email}`,
            limit: 5,
            windowMs: 5 * 60 * 1000,
          });

          if (!rateLimit.allowed) {
            await writeIdentitySecurityAuditEvent({
              email,
              action: "REJECT",
              eventType: "RATE_LIMITED",
              entityId: email,
              reason: "Credential sign-in attempt exceeded the configured rate limit.",
              metadata: {
                resetAt: rateLimit.resetAt.toISOString(),
              },
            });

            throw new RateLimitError(rateLimit.resetAt);
          }
        }

        if (email && password) {
          const portalUser = await authenticateLocalAccount(email, password);
          if (portalUser) {
            await getDb().user.update({
              where: { id: portalUser.id },
              data: { lastSignedInAt: new Date() },
            });
            await writeIdentitySecurityAuditEvent({
              email,
              action: "LOGIN",
              eventType: "AUTH_ATTEMPT",
              entityId: email,
              reason: "Local credential sign-in succeeded.",
              metadata: {
                outcome: "SUCCESS",
                authenticationMethod: "LOCAL_CREDENTIALS",
              },
            });
            return portalUser;
          }

          await writeIdentitySecurityAuditEvent({
            email,
            action: "REJECT",
            eventType: "AUTH_ATTEMPT",
            entityId: email,
            reason: "Credential sign-in failed.",
            metadata: {
              outcome: "FAILED",
              authenticationMethod: "LOCAL_CREDENTIALS",
            },
          });

          return null;
        }

        await writeIdentitySecurityAuditEvent({
          email,
          action: "REJECT",
          eventType: "AUTH_ATTEMPT",
          entityId: email ?? "missing-email",
          reason: "Credential sign-in failed because required credentials were missing.",
          metadata: {
            outcome: "FAILED",
            authenticationMethod: "CREDENTIALS",
          },
        });

        return null;
      },
    }),
    ...oauthProviders,
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "credentials") return true;
      if (!user.email) return false;

      if (account?.provider === "google") {
        const googleProfile = profile as { email_verified?: boolean } | undefined;
        if (googleProfile?.email_verified !== true) return false;
        await provisionVerifiedGoogleEmployer(user.email, user.name ?? user.email);
        await getDb().user.update({
          where: { email: user.email.toLowerCase() },
          data: { lastSignedInAt: new Date() },
        });
      }

      return Boolean(await getAuthorizedDirectoryUser(user.email));
    },
    redirect({ url, baseUrl }) {
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }

      if (url.startsWith(baseUrl)) {
        return url;
      }

      return baseUrl;
    },
    async jwt({ token, user }) {
      const email = user?.email ?? token.email;
      const directoryUser = email ? await getAuthorizedDirectoryUser(email) : null;

      if (directoryUser) {
        token.role = directoryUser.role;
        token.sub = directoryUser.id;
        token.mustChangePassword = directoryUser.mustChangePassword;
      } else if (user) {
        token.role = (user as User & { role?: Role }).role ?? "EMPLOYER_VIEWER";
        token.sub = user.id;
        token.mustChangePassword = Boolean((user as User & { mustChangePassword?: boolean }).mustChangePassword);
      } else {
        token.role = "EMPLOYER_VIEWER";
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = (token.role as Role | undefined) ?? "EMPLOYER_VIEWER";
        session.user.mustChangePassword = Boolean(token.mustChangePassword);
      }

      return session;
    },
  },
};
