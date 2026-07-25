import { auth } from "@/auth";
import { redirect } from "next/navigation";

import { LoginForm } from "./login-form";

export default async function AdminLoginPage() {
  const session = await auth();
  if (session?.user) {
    if (
      (session.user.role === "OWNER" || session.user.role === "ADMIN") &&
      !session.user.twoFactorEnabled
    ) {
      redirect("/admin/2fa");
    }
    redirect("/admin");
  }

  return (
    <main className="mx-auto flex min-block-size-[100dvh] max-w-lg flex-col justify-center px-6 py-12">
      <p className="font-sans text-xs uppercase tracking-[0.12em] text-chalk">
        AKS · admin
      </p>
      <h1 className="mt-2 font-display text-4xl text-greige">Sign in</h1>
      <p className="mt-2 max-w-md text-sm text-chalk">
        Passwordless access. We email a one-time code — no passwords.
      </p>
      <LoginForm />
    </main>
  );
}
