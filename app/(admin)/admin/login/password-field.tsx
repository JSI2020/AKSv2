"use client";

import { useState } from "react";

/** Password input with a show/hide toggle, styled for the indigo auth pages. */
export function PasswordField({
  label,
  name,
  autoComplete,
  value,
  onChange,
  disabled,
  hint,
}: {
  label: string;
  name: string;
  autoComplete: "current-password" | "new-password";
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs uppercase tracking-[0.12em] text-chalk">
        {label}
      </span>
      <span className="flex border border-chalk/50 bg-indigo-lift focus-within:border-chalk">
        <input
          type={visible ? "text" : "password"}
          name={name}
          autoComplete={autoComplete}
          required
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-[13px] text-greige outline-none"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="px-3 text-[11px] uppercase tracking-[0.1em] text-chalk hover:text-greige"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </span>
      {hint ? <span className="text-[11px] text-chalk">{hint}</span> : null}
    </label>
  );
}
