import { auth } from "@/auth";
import {
  getPermissionsForUser,
  PermissionsProvider,
  rolesRequiring2fa,
} from "@/modules/auth";
import { AdminShell } from "@/modules/admin";
import { redirect } from "next/navigation";

/**
 * Authenticated admin shell: permission-filtered nav, ⌘K, indigo 13px density.
 * OWNER/ADMIN without 2FA are sent to enrolment.
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

  const permissions = await getPermissionsForUser(session.user.id);

  return (
    <PermissionsProvider permissions={[...permissions]}>
      <AdminShell email={session.user.email}>{children}</AdminShell>
    </PermissionsProvider>
  );
}
