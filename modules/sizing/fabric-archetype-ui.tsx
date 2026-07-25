"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { formatModelDisclosure } from "@aks/shared";
import { Measure, Money } from "@/modules/ui";

import {
  saveFabric,
  saveHouseModel,
  type FabricRow,
  type HouseModelRow,
} from "./fabric-archetype-actions";

export function FabricForm({ fabric }: { fabric: FabricRow | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (fabric) fd.set("id", fabric.id);
    startTransition(async () => {
      const res = await saveFabric(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/admin/fabrics");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-3">
      {(["name", "composition"] as const).map((field) => (
        <label key={field} className="flex flex-col gap-1">
          <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
            {field}
          </span>
          <input
            name={field}
            defaultValue={fabric?.[field] ?? ""}
            required
            className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige outline-none focus:border-zari"
          />
        </label>
      ))}
      {(
        [
          ["widthInches", fabric?.widthInches ?? 4400],
          ["weightGsm", fabric?.weightGsm ?? 100],
          ["stretchPercent", fabric?.stretchPercent ?? 0],
          ["shrinkageAllowance", fabric?.shrinkageAllowance ?? 0],
          ["costPerMeterMinor", fabric?.costPerMeterMinor ?? 0],
        ] as const
      ).map(([name, val]) => (
        <label key={name} className="flex flex-col gap-1">
          <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
            {name}
          </span>
          <input
            name={name}
            type="number"
            defaultValue={val ?? 0}
            required
            className="border border-indigo-lift bg-indigo px-2 py-1.5 font-data text-[13px] text-greige outline-none focus:border-zari"
          />
        </label>
      ))}
      <label className="flex flex-col gap-1">
        <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
          drapeClass
        </span>
        <select
          name="drapeClass"
          defaultValue={fabric?.drapeClass ?? "MEDIUM"}
          className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige outline-none focus:border-zari"
        >
          <option value="LIGHT">LIGHT</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="HEAVY">HEAVY</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
          careInstructions
        </span>
        <input
          name="careInstructions"
          defaultValue={fabric?.careInstructions ?? ""}
          className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige outline-none focus:border-zari"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
          drapeNotes
        </span>
        <input
          name="drapeNotes"
          defaultValue={fabric?.drapeNotes ?? ""}
          className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige outline-none focus:border-zari"
        />
      </label>
      <input type="hidden" name="active" value="true" />
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

export function HouseModelForm({ model }: { model: HouseModelRow | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ai, setAi] = useState(true);

  const liveDisclosure = formatModelDisclosure({
    heightInches: model?.heightInches ?? 6700,
    heightCm: model?.heightCm ?? 170,
    wearsSizeLabel: model?.wearsSizeLabel ?? "M",
    bust: model?.bust ?? 3600,
    waist: model?.waist ?? 2800,
    hip: model?.hip ?? 3800,
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (model) fd.set("id", model.id);
    fd.set("isAiGenerated", ai ? "true" : "false");
    startTransition(async () => {
      const res = await saveHouseModel(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/admin/settings/sizing/archetypes");
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
          name="name"
          defaultValue={model?.name ?? ""}
          required
          className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige outline-none focus:border-zari"
        />
      </label>
      {(
        [
          ["heightCm", model?.heightCm ?? 170],
          ["heightInches", model?.heightInches ?? 6700],
          ["bust", model?.bust ?? 3600],
          ["waist", model?.waist ?? 2800],
          ["hip", model?.hip ?? 3800],
          ["shoulder", model?.shoulder ?? 1450],
        ] as const
      ).map(([name, val]) => (
        <label key={name} className="flex flex-col gap-1">
          <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
            {name}
          </span>
          <input
            name={name}
            type="number"
            defaultValue={val}
            required
            className="border border-indigo-lift bg-indigo px-2 py-1.5 font-data text-[13px] text-greige outline-none focus:border-zari"
          />
        </label>
      ))}
      <label className="flex flex-col gap-1">
        <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
          wearsSizeLabel
        </span>
        <input
          name="wearsSizeLabel"
          defaultValue={model?.wearsSizeLabel ?? "M"}
          required
          className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige outline-none focus:border-zari"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
          identitySeed
        </span>
        <input
          name="identitySeed"
          defaultValue={model?.identitySeed ?? ""}
          required
          className="border border-indigo-lift bg-indigo px-2 py-1.5 font-data text-[13px] text-greige outline-none focus:border-zari"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
          buildDescription
        </span>
        <input
          name="buildDescription"
          defaultValue={model?.buildDescription ?? ""}
          className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige outline-none focus:border-zari"
        />
      </label>
      <label className="flex items-center gap-2 text-[13px] text-greige">
        <input
          type="checkbox"
          checked={ai}
          onChange={(e) => setAi(e.target.checked)}
          className="size-3.5 accent-zari"
        />
        isAiGenerated (required — must stay true)
      </label>
      <input type="hidden" name="active" value="true" />
      <input type="hidden" name="isDefault" value={model?.isDefault ? "true" : "false"} />

      <p className="border border-indigo-lift px-3 py-2 text-[13px] text-greige">
        {liveDisclosure}
      </p>

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

export function FabricListRow({ fabric }: { fabric: FabricRow }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
      <div>
        <p className="text-[13px] text-greige">{fabric.name}</p>
        <p className="font-data text-[11px] text-chalk">
          {fabric.composition} · {fabric.drapeClass} · stretch{" "}
          {fabric.stretchPercent}% · shrink{" "}
          <Measure value={fabric.shrinkageAllowance} />
        </p>
      </div>
      <Money value={fabric.costPerMeterMinor} className="text-[12px] text-chalk" />
    </div>
  );
}
