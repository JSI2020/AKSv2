"use client";

import { useState, useTransition } from "react";

import {
  deleteHouseCollectionAction,
  saveHouseCollectionAction,
  setHouseCollectionActiveAction,
  type HouseCollectionAdminRow,
} from "@/modules/content/house-collection-actions";

const emptyForm = {
  title: "",
  navLabel: "",
  tag: "",
  slug: "",
  itemCode: "",
  tagline: "",
  card: "",
  intro: "",
  sortOrder: 0,
  active: true,
};

export function CollectionsAdmin({
  initial,
}: {
  initial: HouseCollectionAdminRow[];
}) {
  const [rows, setRows] = useState(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [msg, setMsg] = useState<string | null>(null);
  const [migrateToId, setMigrateToId] = useState("");
  const [pending, start] = useTransition();

  function startCreate() {
    setEditingId(null);
    setForm({ ...emptyForm, sortOrder: rows.length });
    setMsg(null);
  }

  function startEdit(row: HouseCollectionAdminRow) {
    setEditingId(row.id);
    setForm({
      title: row.title,
      navLabel: row.navLabel,
      tag: row.tag,
      slug: row.slug,
      itemCode: row.itemCode,
      tagline: row.tagline,
      card: row.card,
      intro: row.intro,
      sortOrder: row.sortOrder,
      active: row.active,
    });
    setMsg(null);
  }

  return (
    <div className="mt-6 space-y-8">
      <form
        className="grid max-w-3xl gap-3 border border-indigo-lift p-4 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await saveHouseCollectionAction({
              id: editingId ?? undefined,
              ...form,
            });
            if (!res.ok) {
              setMsg(res.error);
              return;
            }
            const refreshed = await fetch("/admin/content/collections", {
              cache: "no-store",
            });
            void refreshed;
            setMsg(editingId ? "Collection updated." : "Collection created.");
            window.location.reload();
          });
        }}
      >
        <p className="md:col-span-2 text-[12px] text-chalk">
          {editingId
            ? "Edit house door — changing tag or slug moves designs, gates, and nav links."
            : "Create a new house door for the storefront."}
        </p>
        <label className="flex flex-col gap-1 text-[12px] text-chalk">
          Title
          <input
            required
            className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-chalk">
          Nav label
          <input
            className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
            value={form.navLabel}
            onChange={(e) => setForm({ ...form, navLabel: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-chalk">
          Tag (FREE design tag)
          <input
            className="border border-indigo-lift bg-indigo px-2 py-1.5 font-data text-[13px] text-greige uppercase"
            value={form.tag}
            onChange={(e) => setForm({ ...form, tag: e.target.value })}
            placeholder="ESSENTIALS"
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-chalk">
          URL slug
          <input
            className="border border-indigo-lift bg-indigo px-2 py-1.5 font-data text-[13px] text-greige"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            placeholder="essentials"
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-chalk">
          Item code (2 chars)
          <input
            maxLength={2}
            className="border border-indigo-lift bg-indigo px-2 py-1.5 font-data text-[13px] text-greige"
            value={form.itemCode}
            onChange={(e) => setForm({ ...form, itemCode: e.target.value })}
            placeholder="es"
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-chalk">
          Sort order
          <input
            type="number"
            className="border border-indigo-lift bg-indigo px-2 py-1.5 font-data text-[13px] text-greige"
            value={form.sortOrder}
            onChange={(e) =>
              setForm({ ...form, sortOrder: Number.parseInt(e.target.value, 10) || 0 })
            }
          />
        </label>
        <label className="md:col-span-2 flex flex-col gap-1 text-[12px] text-chalk">
          Tagline
          <input
            className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
            value={form.tagline}
            onChange={(e) => setForm({ ...form, tagline: e.target.value })}
          />
        </label>
        <label className="md:col-span-2 flex flex-col gap-1 text-[12px] text-chalk">
          Card blurb (hub)
          <textarea
            rows={2}
            className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
            value={form.card}
            onChange={(e) => setForm({ ...form, card: e.target.value })}
          />
        </label>
        <label className="md:col-span-2 flex flex-col gap-1 text-[12px] text-chalk">
          Landing intro
          <textarea
            rows={4}
            className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
            value={form.intro}
            onChange={(e) => setForm({ ...form, intro: e.target.value })}
          />
        </label>
        <label className="flex items-center gap-2 text-[12px] text-chalk">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />
          Active on storefront
        </label>
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="bg-zari px-3 py-1.5 text-[13px] text-indigo"
          >
            {pending ? "Saving…" : editingId ? "Save changes" : "Create collection"}
          </button>
          {editingId ? (
            <button
              type="button"
              className="border border-indigo-lift px-3 py-1.5 text-[13px] text-chalk"
              onClick={startCreate}
            >
              Cancel edit
            </button>
          ) : null}
        </div>
        {msg ? (
          <p className="md:col-span-2 text-[12px] text-chalk" role="status">
            {msg}
          </p>
        ) : null}
      </form>

      <div className="overflow-x-auto border border-indigo-lift">
        <table className="w-full min-w-[720px] text-left text-[13px] text-greige">
          <thead className="border-b border-indigo-lift text-[11px] uppercase tracking-wide text-chalk">
            <tr>
              <th className="px-3 py-2">Door</th>
              <th className="px-3 py-2">Slug</th>
              <th className="px-3 py-2">Tag</th>
              <th className="px-3 py-2">Designs</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-indigo-lift/60">
                <td className="px-3 py-2">{row.navLabel}</td>
                <td className="px-3 py-2 font-data text-chalk">/{row.slug}</td>
                <td className="px-3 py-2 font-data text-chalk">{row.tag}</td>
                <td className="px-3 py-2">{row.designCount}</td>
                <td className="px-3 py-2">{row.active ? "Active" : "Hidden"}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="text-zari underline"
                      onClick={() => startEdit(row)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-chalk underline"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const res = await setHouseCollectionActiveAction({
                            id: row.id,
                            active: !row.active,
                          });
                          setMsg(res.ok ? "Status updated." : res.error);
                          if (res.ok) window.location.reload();
                        })
                      }
                    >
                      {row.active ? "Hide" : "Show"}
                    </button>
                    <button
                      type="button"
                      className="text-madder underline"
                      disabled={pending}
                      onClick={() => {
                        if (
                          row.designCount > 0 &&
                          !migrateToId &&
                          !window.confirm(
                            `${row.designCount} design(s) tagged — pick a target in the migrate field below before delete, or cancel.`,
                          )
                        ) {
                          return;
                        }
                        if (
                          !window.confirm(
                            `Delete ${row.navLabel}? This cannot be undone.`,
                          )
                        ) {
                          return;
                        }
                        start(async () => {
                          const res = await deleteHouseCollectionAction({
                            id: row.id,
                            migrateToId: migrateToId || null,
                          });
                          setMsg(res.ok ? "Collection deleted." : res.error);
                          if (res.ok) window.location.reload();
                        });
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <label className="flex max-w-md flex-col gap-1 text-[12px] text-chalk">
        Migrate designs to (required before delete if designs exist)
        <select
          className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
          value={migrateToId}
          onChange={(e) => setMigrateToId(e.target.value)}
        >
          <option value="">Select target door…</option>
          {rows.map((r) => (
            <option key={r.id} value={r.id}>
              {r.navLabel}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
