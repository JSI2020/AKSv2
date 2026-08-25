"use client";

import { useState, useTransition } from "react";

import {
  deleteAnnouncementAction,
  saveAnnouncementAction,
} from "@/modules/content/actions";

type Row = {
  id: string;
  message: string;
  link: { type: string; value: string } | null;
  active: boolean;
  sortOrder: number;
  startsAt: Date | null;
  endsAt: Date | null;
};

function toLocalInput(d: Date | null): string {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const emptyForm = {
  message: "",
  linkValue: "",
  active: true,
  startsAt: "",
  endsAt: "",
};

export function AnnouncementsAdmin({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setMsg(null);
  }

  function startEdit(row: Row) {
    setEditingId(row.id);
    setForm({
      message: row.message,
      linkValue: row.link?.value ?? "",
      active: row.active,
      startsAt: toLocalInput(row.startsAt),
      endsAt: toLocalInput(row.endsAt),
    });
    setMsg(null);
  }

  return (
    <div className="mt-6 space-y-6">
      <form
        className="flex max-w-xl flex-col gap-3 border border-indigo-lift p-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const sortOrder = editingId
              ? (rows.find((r) => r.id === editingId)?.sortOrder ?? 0)
              : rows.length;
            const res = await saveAnnouncementAction({
              id: editingId ?? undefined,
              message: form.message,
              linkType: "url",
              linkValue: form.linkValue,
              active: form.active,
              sortOrder,
              startsAt: form.startsAt,
              endsAt: form.endsAt,
            });
            if (!res.ok || !res.id) {
              setMsg(res.ok ? "Save failed." : res.error);
              return;
            }
            const next: Row = {
              id: res.id,
              message: form.message,
              link: form.linkValue
                ? { type: "url", value: form.linkValue }
                : null,
              active: form.active,
              sortOrder,
              startsAt: form.startsAt ? new Date(form.startsAt) : null,
              endsAt: form.endsAt ? new Date(form.endsAt) : null,
            };
            setRows((r) =>
              editingId
                ? r.map((x) => (x.id === editingId ? next : x))
                : [...r, next],
            );
            setMsg(editingId ? "Announcement updated." : "Announcement added.");
            startCreate();
          });
        }}
      >
        <p className="text-[12px] text-chalk">
          {editingId ? "Editing announcement" : "Add a storefront banner message"}
        </p>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase text-chalk">Message</span>
          <input
            required
            className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
            value={form.message}
            onChange={(e) =>
              setForm((f) => ({ ...f, message: e.target.value }))
            }
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase text-chalk">Link (optional)</span>
          <input
            className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
            value={form.linkValue}
            onChange={(e) =>
              setForm((f) => ({ ...f, linkValue: e.target.value }))
            }
            placeholder="https://… or leave blank"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase text-chalk">Starts</span>
            <input
              type="datetime-local"
              className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
              value={form.startsAt}
              onChange={(e) =>
                setForm((f) => ({ ...f, startsAt: e.target.value }))
              }
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase text-chalk">Ends</span>
            <input
              type="datetime-local"
              className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
              value={form.endsAt}
              onChange={(e) =>
                setForm((f) => ({ ...f, endsAt: e.target.value }))
              }
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-[13px] text-greige">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) =>
              setForm((f) => ({ ...f, active: e.target.checked }))
            }
          />
          Active (shows when within schedule)
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={pending}
            className="self-start border border-zari px-3 py-1.5 text-[12px] uppercase text-zari"
          >
            {editingId ? "Save changes" : "Add message"}
          </button>
          {editingId ? (
            <button
              type="button"
              className="border border-indigo-lift px-3 py-1.5 text-[12px] uppercase text-chalk"
              onClick={startCreate}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>

      <ul className="divide-y divide-indigo-lift border border-indigo-lift">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-4 px-3 py-2 text-[13px] text-greige"
          >
            <span>
              {row.active ? "" : "(off) "}
              {row.message}
            </span>
            <div className="flex gap-3">
              <button
                type="button"
                className="text-[11px] uppercase text-zari"
                onClick={() => startEdit(row)}
              >
                Edit
              </button>
              <button
                type="button"
                className="text-[11px] uppercase text-madder"
                onClick={() => {
                  start(async () => {
                    const res = await deleteAnnouncementAction(row.id);
                    if (res.ok) {
                      setRows((r) => r.filter((x) => x.id !== row.id));
                      if (editingId === row.id) startCreate();
                    } else setMsg(res.error);
                  });
                }}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
        {rows.length === 0 ? (
          <li className="px-3 py-4 text-[13px] text-chalk">
            No announcements yet.
          </li>
        ) : null}
      </ul>
      {msg ? <p className="text-[12px] text-chalk">{msg}</p> : null}
    </div>
  );
}
