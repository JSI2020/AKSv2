import { auth } from "@/auth";
import { redirect } from "next/navigation";

import { adminTwoFactorEnforced } from "@/modules/auth";
import { AksLogoImage } from "@/modules/shop/shell/brand";

import { LoginForm } from "./login-form";

export default async function AdminLoginPage() {
  const session = await auth();
  if (session?.user && session.user.role !== "CUSTOMER") {
    if (
      adminTwoFactorEnforced() &&
      (session.user.role === "OWNER" || session.user.role === "ADMIN") &&
      !session.user.twoFactorEnabled
    ) {
      redirect("/admin/2fa");
    }
    redirect("/admin");
  }

  return (
    <main className="mx-auto flex min-block-size-[100dvh] max-w-lg flex-col justify-center bg-indigo px-6 py-12 text-greige">
      <div className="mb-6">
        <AksLogoImage size="lockup" priority />
      </div>
      <p className="font-sans text-xs uppercase tracking-[0.12em] text-chalk">
        Admin
      </p>
      <h1 className="mt-2 font-display text-4xl text-greige">Sign in</h1>
      <p className="mt-2 max-w-md text-sm text-chalk">
        Passwordless access. We email a one-time code — valid for 24 hours.
      </p>
      <LoginForm />
    </main>
  );
}
