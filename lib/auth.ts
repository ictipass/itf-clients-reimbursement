import type { NextAuthOptions, User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { getDb } from "@/lib/db";
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
        const email = credentials?.email?.toLowerCase();
        const password = credentials?.password;

        if (
          email === bootstrapUser.email?.toLowerCase() &&
          password === expectedPassword
        ) {
          return bootstrapUser;
        }

        if (email && password) {
          return getDevelopmentTestUser(email, password);
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
