import { auth } from "@/auth";
import { redirect } from "next/navigation";

import { TotpEnrolForm } from "./enroll-form";

export default async function AdminTwoFactorPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/admin/login");
  }

  if (session.user.twoFactorEnabled) {
    redirect("/admin");
  }

  return (
    <main className="mx-auto flex min-block-size-[100dvh] max-w-lg flex-col justify-center px-6 py-12">
      <p className="font-sans text-xs uppercase tracking-[0.12em] text-chalk">
        AKS · security
      </p>
      <h1 className="mt-2 font-display text-4xl text-greige">
        Two-factor authentication
      </h1>
      <p className="mt-2 text-sm text-chalk">
        OWNER and ADMIN accounts must enrol an authenticator before using the
        portal.
      </p>
      <TotpEnrolForm email={session.user.email ?? ""} />
    </main>
  );
}
