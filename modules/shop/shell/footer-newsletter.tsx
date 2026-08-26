"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export function FooterNewsletter() {
  const t = useTranslations("ShopShell");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setNote(t("newsletterInvalid"));
      return;
    }
    setNote(t("newsletterThanks"));
    setEmail("");
  }

  return (
    <div>
      <form className="news" onSubmit={onSubmit} noValidate>
        <input
          type="email"
          name="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (note) setNote(null);
          }}
          placeholder={t("footerEmailPlaceholder")}
          aria-label={t("footerEmailPlaceholder")}
          autoComplete="email"
        />
        <button type="submit" aria-label={t("footerSubscribe")}>
          <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
            <use href="#ic-arrow" />
          </svg>
        </button>
      </form>
      {note ? <p className="news-note">{note}</p> : null}
    </div>
  );
}
