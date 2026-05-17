import type { NextAuthOptions, User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { seedRoles } from "@/lib/domain";
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

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
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

        if (
          credentials?.email?.toLowerCase() === bootstrapUser.email?.toLowerCase() &&
          credentials?.password === expectedPassword
        ) {
          return bootstrapUser;
        }

        return null;
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as User & { role?: Role }).role ?? fallbackAdmin.role;
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
