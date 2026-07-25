import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    role?: string;
    twoFactorEnabled?: boolean;
    requires2faEnrolment?: boolean;
    sessionId?: string;
  }

  interface Session {
    sessionId: string;
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      role: string;
      twoFactorEnabled: boolean;
      requires2faEnrolment: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    twoFactorEnabled?: boolean;
    requires2faEnrolment?: boolean;
    sessionId?: string;
  }
}
