"use client";

import { useEffect, useState } from "react";

import { Link } from "@/i18n/routing";
import type { AnnouncementPublic } from "@/modules/content/types";

export function AnnouncementTicker({
  items,
}: {
  items: AnnouncementPublic[];
}) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"in" | "out">("in");

  useEffect(() => {
    if (items.length <= 1) return;
    const id = window.setInterval(() => {
      setPhase("out");
      window.setTimeout(() => {
        setIndex((i) => (i + 1) % items.length);
        setPhase("in");
      }, 320);
    }, 4800);
    return () => window.clearInterval(id);
  }, [items.length]);

  if (items.length === 0) return null;
  const current = items[index] ?? items[0]!;

  const inner = (
    <span
      className={`ticker-msg ticker-msg--${phase}`}
      key={`${current.id}-${index}`}
    >
      {current.message}
    </span>
  );

  return (
    <div className="announcement-ticker" role="status" aria-live="polite">
      <div className="ticker-track">
        {current.href ? (
          current.href.startsWith("http") ? (
            <a href={current.href} rel="noreferrer" target="_blank">
              {inner}
            </a>
          ) : (
            <Link href={current.href as "/collections"}>{inner}</Link>
          )
        ) : (
          inner
        )}
      </div>
      {items.length > 1 ? (
        <div className="ticker-dots" aria-hidden>
          {items.map((item, i) => (
            <span
              key={item.id}
              className={i === index ? "ticker-dot ticker-dot--on" : "ticker-dot"}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
