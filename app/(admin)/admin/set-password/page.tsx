import { auth } from "@/auth";
import { redirect } from "next/navigation";

import { AksLogoImage } from "@/modules/shop/shell/brand";

import { SetPasswordForm } from "./set-password-form";

export default async function AdminSetPasswordPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/admin/login");
  }
  if (session.user.role === "CUSTOMER") {
    redirect("/account/login");
  }
  if (!session.user.mustChangePassword) {
    redirect("/admin");
  }

  return (
    <main className="mx-auto flex min-block-size-[100dvh] max-w-lg flex-col justify-center bg-indigo px-6 py-12 text-greige">
      <div className="mb-6">
        <AksLogoImage size="lockup" priority />
      </div>
      <p className="font-sans text-xs uppercase tracking-[0.12em] text-chalk">
        Welcome
      </p>
      <h1 className="mt-2 font-display text-4xl text-greige">
        Choose your password
      </h1>
      <p className="mt-2 max-w-md text-sm text-chalk">
        You signed in with a one-time password. Pick your own to finish setting
        up {session.user.email ? <strong>{session.user.email}</strong> : "your account"}.
      </p>
      <SetPasswordForm />
    </main>
  );
}
