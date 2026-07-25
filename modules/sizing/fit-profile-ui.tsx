"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { applyFitEase, inches } from "@aks/shared";
import { Measure } from "@/modules/ui";

import {
  createFitProfile,
  updateFitProfile,
  type FitProfileRow,
} from "./fit-profile-actions";

/** Size-M TROUSER body from the default block seeds (for ease preview). */
const TROUSER_M_BODY: Record<string, number> = {
  WAIST: inches(30),
  HIP: inches(38),
  THIGH: inches(22),
  RISE: inches(11),
  LENGTH: inches(38),
  BOTTOM_OPENING: inches(14),
};

const KAMEEZ_M_BODY: Record<string, number> = {
  BUST: inches(36),
  WAIST: inches(32),
  HIP: inches(38),
  SHOULDER: inches(14.5),
  LENGTH: inches(30),
};

const GOWN_M_BODY: Record<string, number> = {
  BUST: inches(36),
  WAIST: inches(32),
  HIP: inches(38),
  LENGTH: inches(52),
};

function bodyForCategory(key: string): Record<string, number> {
  if (key === "TROUSER") return TROUSER_M_BODY;
  if (key === "GOWN") return GOWN_M_BODY;
  return KAMEEZ_M_BODY;
}

type ListProps = {
  profiles: FitProfileRow[];
};

export function FitProfileList({ profiles }: ListProps) {
  const [selectedId, setSelectedId] = useState(
    () => profiles.find((p) => p.name === "Palazzo")?.id ?? profiles[0]?.id,
  );
  const selected = profiles.find((p) => p.id === selectedId) ?? null;

  const preview = useMemo(() => {
    if (!selected) return null;
    const body = bodyForCategory(selected.categoryKey);
    const finished = applyFitEase(body, selected.easeByMeasurement);
    return { body, finished };
  }, [selected]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <ul className="divide-y divide-indigo-lift border border-indigo-lift">
        {profiles.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => setSelectedId(p.id)}
              className={`flex w-full flex-col gap-0.5 px-3 py-2.5 text-start hover:bg-indigo-lift/40 ${
                p.id === selectedId ? "bg-indigo-lift/50" : ""
              }`}
            >
              <span className="text-[13px] text-greige">{p.name}</span>
              <span className="font-data text-[11px] text-chalk">
                {p.categoryKey}
                {p.isDefault ? " · default" : ""} · cling{" "}
                {(p.clingFactorBps / 100).toFixed(2)}
              </span>
            </button>
            <div className="border-t border-indigo-lift/50 px-3 py-1">
              <a
                href={`/admin/settings/sizing/fit-profiles/${p.id}`}
                className="text-[11px] text-zari underline-offset-2 hover:underline"
              >
                Edit
              </a>
            </div>
          </li>
        ))}
      </ul>

      <div className="border border-indigo-lift p-4">
        {selected && preview ? (
          <>
            <p className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
              Preview · size M body + {selected.name}
            </p>
            <h2 className="mt-1 font-display text-2xl text-greige">
              {selected.name}
            </h2>
            <p className="mt-1 text-[12px] text-chalk">
              Body vs finished garment (ease applied). Cling{" "}
              {(selected.clingFactorBps / 100).toFixed(2)} stored for 3D guide —
              not used yet.
            </p>
            <table className="mt-4 w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-indigo-lift">
                  <th className="py-1 text-start font-sans text-[11px] uppercase tracking-[0.1em] text-chalk">
                    Key
                  </th>
                  <th className="py-1 text-end font-sans text-[11px] uppercase tracking-[0.1em] text-chalk">
                    Body
                  </th>
                  <th className="py-1 text-end font-sans text-[11px] uppercase tracking-[0.1em] text-chalk">
                    Finished
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.keys({
                  ...preview.body,
                  ...preview.finished,
                }).map((key) => (
                  <tr key={key} className="border-b border-indigo-lift/60">
                    <td className="py-1.5 font-data text-[12px] text-greige">
                      {key}
                    </td>
                    <td className="py-1.5 text-end">
                      {preview.body[key] !== undefined ? (
                        <Measure value={preview.body[key]!} />
                      ) : (
                        <span className="text-chalk">—</span>
                      )}
                    </td>
                    <td className="py-1.5 text-end text-zari">
                      <Measure value={preview.finished[key]!} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p className="text-[13px] text-chalk">Select a profile</p>
        )}
      </div>
    </div>
  );
}

type FormProps = {
  profile: FitProfileRow | null;
  categories: { id: string; key: string; name: string }[];
  mode: "create" | "edit";
};

export function FitProfileForm({ profile, categories, mode }: FormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(profile?.name ?? "");
  const [categoryId, setCategoryId] = useState(
    profile?.categoryId ?? categories[0]?.id ?? "",
  );
  const [cling, setCling] = useState(String(profile?.clingFactorBps ?? 40));
  const [sortOrder, setSortOrder] = useState(String(profile?.sortOrder ?? 100));
  const [active, setActive] = useState(profile?.active ?? true);
  const [isDefault, setIsDefault] = useState(profile?.isDefault ?? false);
  const [notes, setNotes] = useState(profile?.notes ?? "");
  const [easeJson, setEaseJson] = useState(
    JSON.stringify(profile?.easeByMeasurement ?? { WAIST: 100, HIP: 200 }, null, 2),
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    let ease: unknown;
    try {
      ease = JSON.parse(easeJson);
    } catch {
      setError("easeByMeasurement must be valid JSON");
      return;
    }

    const fd = new FormData();
    fd.set("name", name);
    fd.set("clingFactorBps", cling);
    fd.set("sortOrder", sortOrder);
    fd.set("active", active ? "true" : "false");
    fd.set("isDefault", isDefault ? "true" : "false");
    fd.set("notes", notes);
    fd.set("easeByMeasurement", JSON.stringify(ease));

    startTransition(async () => {
      const result =
        mode === "edit" && profile
          ? (() => {
              fd.set("id", profile.id);
              return updateFitProfile(fd);
            })()
          : (() => {
              fd.set("categoryId", categoryId);
              return createFitProfile(fd);
            })();
      const res = await result;
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/admin/settings/sizing/fit-profiles");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
          Name
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige outline-none focus:border-zari"
        />
      </label>

      {mode === "create" ? (
        <label className="flex flex-col gap-1">
          <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
            Category
          </span>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige outline-none focus:border-zari"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.key} — {c.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="font-data text-[12px] text-chalk">
          {profile?.categoryKey}
        </p>
      )}

      <label className="flex flex-col gap-1">
        <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
          Cling factor (0–100 bps)
        </span>
        <input
          type="number"
          min={0}
          max={100}
          value={cling}
          onChange={(e) => setCling(e.target.value)}
          className="border border-indigo-lift bg-indigo px-2 py-1.5 font-data text-[13px] text-greige outline-none focus:border-zari"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
          Ease by measurement (JSON, hundredths)
        </span>
        <textarea
          value={easeJson}
          onChange={(e) => setEaseJson(e.target.value)}
          rows={8}
          className="border border-indigo-lift bg-indigo px-2 py-1.5 font-data text-[12px] text-greige outline-none focus:border-zari"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
          Sort order
        </span>
        <input
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className="border border-indigo-lift bg-indigo px-2 py-1.5 font-data text-[13px] text-greige outline-none focus:border-zari"
        />
      </label>

      {mode === "edit" ? (
        <>
          <label className="flex items-center gap-2 text-[13px] text-greige">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="size-3.5 accent-zari"
            />
            Active
          </label>
          <label className="flex items-center gap-2 text-[13px] text-greige">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="size-3.5 accent-zari"
            />
            Default for category
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
              Notes
            </span>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige outline-none focus:border-zari"
            />
          </label>
        </>
      ) : null}

      {error ? (
        <p className="text-[13px] text-madder" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="border border-zari bg-zari px-3 py-1.5 text-[13px] text-indigo disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
