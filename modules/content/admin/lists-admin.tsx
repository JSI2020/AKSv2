"use client";

import { useState, useTransition } from "react";

import { saveContentListAction } from "@/modules/content/actions";
import type { ContentListItem } from "@/modules/content/types";

export function ListsAdmin({
  listKey,
  initial,
}: {
  listKey: string;
  initial: ContentListItem[];
}) {
  const [text, setText] = useState(
    initial.map((i) => i.text).join("\n"),
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="mt-6 max-w-2xl border border-indigo-lift p-4">
      <p className="text-[12px] text-chalk">
        One construction principle per line ({listKey}).
      </p>
      <textarea
        className="mt-3 min-h-48 w-full border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        type="button"
        disabled={pending}
        className="mt-3 border border-zari px-3 py-1.5 text-[12px] uppercase text-zari"
        onClick={() => {
          start(async () => {
            const items = text
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean)
              .map((line, i) => ({
                id: initial[i]?.id ?? `new-${i}`,
                text: line,
              }));
            const res = await saveContentListAction({
              key: listKey,
              itemsJson: JSON.stringify(items),
            });
            setMsg(res.ok ? "Saved — storefront atelier list updated." : res.error);
          });
        }}
      >
        Save list
      </button>
      {msg ? <p className="mt-2 text-[12px] text-chalk">{msg}</p> : null}
    </div>
  );
}
