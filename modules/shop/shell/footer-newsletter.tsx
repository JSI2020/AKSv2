"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";

import { subscribeToNewsletter } from "./newsletter-actions";

export function FooterNewsletter() {
  const t = useTranslations("ShopShell");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setNote(t("newsletterInvalid"));
      return;
    }
    setNote(null);
    startTransition(async () => {
      const res = await subscribeToNewsletter(trimmed, locale);
      if (res.ok) {
        setNote(t("newsletterThanks"));
        setEmail("");
      } else {
        setNote(t(res.error === "invalid" ? "newsletterInvalid" : "newsletterError"));
      }
    });
  }

  return (
    <div>
      <form className="news" onSubmit={onSubmit} noValidate>
        <input
          type="email"
          name="email"
          value={email}
          disabled={pending}
          onChange={(e) => {
            setEmail(e.target.value);
            if (note) setNote(null);
          }}
          placeholder={t("footerEmailPlaceholder")}
          aria-label={t("footerEmailPlaceholder")}
          autoComplete="email"
        />
        <button type="submit" disabled={pending} aria-label={t("footerSubscribe")}>
          <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
            <use href="#ic-arrow" />
          </svg>
        </button>
      </form>
      {note ? <p className="news-note">{note}</p> : null}
    </div>
  );
}
