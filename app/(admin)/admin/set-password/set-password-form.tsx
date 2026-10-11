"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { PasswordField } from "../login/password-field";
import { setOwnPasswordAction } from "./actions";

export function SetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="mt-8 flex max-w-sm flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await setOwnPasswordAction({ password, confirm });
          if ("error" in result) {
            setError(result.error);
            return;
          }
          // Owner/Admin continue to authenticator setup (middleware decides).
          router.replace("/admin");
          router.refresh();
        });
      }}
    >
      <PasswordField
        label="New password"
        name="new-password"
        autoComplete="new-password"
        value={password}
        onChange={setPassword}
        disabled={pending}
        hint="At least 10 characters, with a letter and a number."
      />
      <PasswordField
        label="Repeat new password"
        name="confirm-password"
        autoComplete="new-password"
        value={confirm}
        onChange={setConfirm}
        disabled={pending}
      />
      {error ? <p className="text-sm text-madder">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="border border-zari bg-zari px-3 py-2 text-[13px] font-medium text-ink disabled:opacity-50"
      >
        {pending ? "Please wait…" : "Save password and continue"}
      </button>
    </form>
  );
}
