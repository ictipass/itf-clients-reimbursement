import type { NextAuthOptions, User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

import { writeIdentitySecurityAuditEvent } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { seedRoles } from "@/lib/domain";
import { authenticatePortalAccount, provisionVerifiedGoogleEmployer } from "@/lib/employer-accounts";
import { checkRateLimit, RateLimitError } from "@/lib/rate-limit";
import { roles, type Role } from "@/lib/rbac";

const fallbackRole: Role = "SYSTEM_ADMIN";

const fallbackAdmin = {
  id: "system-admin",
  name: "System Administrator",
  email: "admin@itf.local",
  role: fallbackRole,
};

function resolveRole(value: string | undefined): Role {
  if (value && roles.includes(value as Role)) {
    return value as Role;
  }

  return fallbackRole;
}

function getBootstrapUser(): User & { role: Role } {
  return {
    id: process.env.BOOTSTRAP_ADMIN_ID ?? fallbackAdmin.id,
    name: process.env.BOOTSTRAP_ADMIN_NAME ?? fallbackAdmin.name,
    email: process.env.BOOTSTRAP_ADMIN_EMAIL ?? fallbackAdmin.email,
    role: resolveRole(process.env.BOOTSTRAP_ADMIN_ROLE),
  };
}

async function getDevelopmentTestUser(email: string, password: string) {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  const expectedPassword = process.env.DEV_TEST_USER_PASSWORD ?? "password123";

  if (password !== expectedPassword) {
    return null;
  }

  const db = getDb();
  const user = await db.user.findUnique({
    where: {
      email: email.toLowerCase(),
    },
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      memberships: {
        select: {
          role: true,
        },
        take: 1,
      },
    },
  });

  if (!user?.isActive || !user.memberships[0]) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.memberships[0].role,
  };
}

async function getAuthorizedDirectoryUser(email: string) {
  const user = await getDb().user.findUnique({
    where: { email: email.toLowerCase() },
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      memberships: { select: { role: true }, take: 1 },
    },
  });

  if (!user?.isActive || !user.memberships[0]) return null;

  return { id: user.id, email: user.email, name: user.name, role: user.memberships[0].role };
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
      name: "Bootstrap Admin",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const bootstrapUser = getBootstrapUser();
        const expectedPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "ChangeMe123!";
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

        if (
          email === bootstrapUser.email?.toLowerCase() &&
          password === expectedPassword
        ) {
          await writeIdentitySecurityAuditEvent({
            email,
            action: "LOGIN",
            eventType: "AUTH_ATTEMPT",
            entityId: email ?? "bootstrap-admin",
            reason: "Credential sign-in succeeded.",
            metadata: {
              outcome: "SUCCESS",
              authenticationMethod: "BOOTSTRAP_CREDENTIALS",
            },
          });

          return bootstrapUser;
        }

        if (email && password) {
          const portalUser = await authenticatePortalAccount(email, password);
          if (portalUser) {
            await writeIdentitySecurityAuditEvent({
              email,
              action: "LOGIN",
              eventType: "AUTH_ATTEMPT",
              entityId: email,
              reason: "Employer portal credential sign-in succeeded.",
              metadata: {
                outcome: "SUCCESS",
                authenticationMethod: "PORTAL_CREDENTIALS",
              },
            });
            return portalUser;
          }

          const developmentUser = await getDevelopmentTestUser(email, password);

          await writeIdentitySecurityAuditEvent({
            email,
            action: developmentUser ? "LOGIN" : "REJECT",
            eventType: "AUTH_ATTEMPT",
            entityId: email,
            reason: developmentUser
              ? "Development credential sign-in succeeded."
              : "Credential sign-in failed.",
            metadata: {
              outcome: developmentUser ? "SUCCESS" : "FAILED",
              authenticationMethod: "DEVELOPMENT_CREDENTIALS",
            },
          });

          return developmentUser;
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
      if (user) {
        const directoryUser = user.email ? await getAuthorizedDirectoryUser(user.email) : null;
        token.role = (user as User & { role?: Role }).role ?? directoryUser?.role ?? fallbackAdmin.role;
        token.sub = directoryUser?.id ?? user.id;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? fallbackAdmin.id;
        session.user.role = (token.role as Role | undefined) ?? fallbackAdmin.role;
      }

      return session;
    },
  },
};

export const bootstrapRoles = seedRoles;
