import type { Role } from "@/lib/rbac";

declare module "next-auth" {
  interface Session {
    user?: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: Role;
      mustChangePassword: boolean;
    };
  }

  interface User {
    role?: Role;
    mustChangePassword?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
    mustChangePassword?: boolean;
  }
}
