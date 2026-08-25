"use client";

import { useState, useTransition } from "react";

import {
  publishContentPageAction,
  saveContentPageAction,
} from "@/modules/content/actions";

type Page = {
  id: string;
  slug: string;
  title: string;
  body: string;
  status: string;
  updatedAt: Date | string;
};

function formatUpdated(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function PagesAdmin({ initial }: { initial: Page[] }) {
  const [pages, setPages] = useState(initial);
  const [selected, setSelected] = useState<Page | null>(initial[0] ?? null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <div className="border border-ink/12 bg-milk p-5">
        <h2 className="mb-2 text-[10px] uppercase tracking-[0.16em] text-ink/55">
          Pages
        </h2>
        <ul>
          {pages.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className={[
                  "flex w-full items-center justify-between border-b border-ink/10 py-3.5 text-start last:border-b-0",
                  selected?.id === p.id ? "opacity-100" : "opacity-90",
                ].join(" ")}
                onClick={() => {
                  setSelected(p);
                  setMsg(null);
                }}
              >
                <span className="font-display text-[1.2rem] text-ink">
                  {p.title}
                </span>
                <span className="text-[11px] text-ink/55">
                  Updated {formatUpdated(p.updatedAt)}
                </span>
              </button>
            </li>
          ))}
          {pages.length === 0 ? (
            <li className="py-4 text-[13px] text-ink/55">No pages yet.</li>
          ) : null}
        </ul>
      </div>

      {selected ? (
        <form
          className="border border-ink/12 bg-milk p-5"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            start(async () => {
              const res = await saveContentPageAction({
                id: selected.id,
                slug: String(fd.get("slug") ?? selected.slug),
                title: String(fd.get("title") ?? selected.title),
                body: String(fd.get("body") ?? ""),
              });
              setMsg(res.ok ? "Saved." : res.error);
              if (res.ok) {
                const next = {
                  ...selected,
                  title: String(fd.get("title") ?? selected.title),
                  slug: String(fd.get("slug") ?? selected.slug),
                  body: String(fd.get("body") ?? ""),
                  updatedAt: new Date(),
                };
                setSelected(next);
                setPages((all) =>
                  all.map((p) => (p.id === next.id ? next : p)),
                );
              }
            });
          }}
        >
          <label className="mb-3 flex flex-col gap-1">
            <span className="text-[10px] uppercase text-ink/55">Title</span>
            <input
              name="title"
              defaultValue={selected.title}
              key={selected.id + "-title"}
              className="border border-ink/12 bg-greige px-3 py-2 text-[13px] text-ink"
            />
          </label>
          <label className="mb-3 flex flex-col gap-1">
            <span className="text-[10px] uppercase text-ink/55">Slug</span>
            <input
              name="slug"
              defaultValue={selected.slug}
              key={selected.id + "-slug"}
              className="border border-ink/12 bg-greige px-3 py-2 font-data text-[12px] text-ink"
            />
          </label>
          <label className="mb-3 flex flex-col gap-1">
            <span className="text-[10px] uppercase text-ink/55">Body</span>
            <textarea
              name="body"
              defaultValue={selected.body}
              key={selected.id + "-body"}
              rows={14}
              className="border border-ink/12 bg-greige px-3 py-2 text-[13px] text-ink"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={pending}
              className="bg-ink px-4 py-2.5 text-[12px] uppercase tracking-[0.08em] text-milk disabled:opacity-40"
            >
              Save
            </button>
            {selected.status !== "PUBLISHED" ? (
              <button
                type="button"
                disabled={pending}
                className="bg-zari px-4 py-2.5 text-[12px] uppercase tracking-[0.08em] text-indigo disabled:opacity-40"
                onClick={() => {
                  start(async () => {
                    const res = await publishContentPageAction(selected.id);
                    setMsg(res.ok ? "Published." : res.error);
                    if (res.ok) {
                      setSelected({ ...selected, status: "PUBLISHED" });
                      setPages((all) =>
                        all.map((p) =>
                          p.id === selected.id
                            ? { ...p, status: "PUBLISHED" }
                            : p,
                        ),
                      );
                    }
                  });
                }}
              >
                Publish
              </button>
            ) : (
              <span className="self-center text-[11px] uppercase text-ink/55">
                Live
              </span>
            )}
          </div>
          {msg ? <p className="mt-3 text-[12px] text-ink/55">{msg}</p> : null}
        </form>
      ) : null}
    </div>
  );
}
