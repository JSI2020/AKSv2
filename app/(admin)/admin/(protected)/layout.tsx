import { auth } from "@/auth";
import { rolesRequiring2fa } from "@/modules/auth";
import { redirect } from "next/navigation";

/**
 * Authenticated admin routes. OWNER/ADMIN without 2FA are sent to enrolment.
 */
export default async function ProtectedAdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  if (!session?.user) {
    redirect("/admin/login");
  }

  if (
    rolesRequiring2fa(session.user.role) &&
    !session.user.twoFactorEnabled
  ) {
    redirect("/admin/2fa");
  }

  return children;
}
