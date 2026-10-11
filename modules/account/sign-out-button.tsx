"use client";

import { useTransition } from "react";
import { signOut } from "next-auth/react";

export function SignOutButton({
  redirectTo = "/",
  label = "Sign out",
}: {
  redirectTo?: string;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await signOut({ callbackUrl: redirectTo });
        })
      }
      className="auth-back"
    >
      {pending ? "Signing out…" : label}
    </button>
  );
}
