"use client";

import { useState, useTransition } from "react";

import { Money } from "@/modules/ui";

import { saveStudioSettings, type StudioSettingsFormData } from "./actions";

type Props = StudioSettingsFormData;

const SIZE_LABELS = ["XS", "S", "M", "L", "XL", "XXL"] as const;
const AI_JOBS = ["hero", "angle", "colourway", "draft"] as const;

function formatUsdMicros(micros: number): string {
  return `$${(micros / 1_000_000).toFixed(4)}`;
}

export function StudioSettingsForm({
  settings,
  archetypes,
  templateVersions,
  estimatedCostUsdMicros,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await saveStudioSettings(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-6">
      <fieldset className="flex flex-col gap-4 border border-indigo-lift p-4">
        <legend className="px-1 font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
          Defaults
        </legend>

        <label className="flex flex-col gap-1">
          <span className="text-[13px] text-greige">Default archetype</span>
          <select
            name="defaultArchetypeId"
            defaultValue={settings.defaultArchetypeId ?? ""}
            className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
          >
            <option value="">— none —</option>
            {archetypes.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.isDefault ? " (house default)" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[13px] text-greige">Default base size</span>
          <select
            name="defaultBaseSizeLabel"
            defaultValue={settings.defaultBaseSizeLabel}
            className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
          >
            {SIZE_LABELS.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[13px] text-greige">
            Backdrop / lighting profile
          </span>
          <textarea
            name="backdropLightingProfile"
            rows={3}
            defaultValue={settings.backdropLightingProfile}
            className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[13px] text-greige">Default lead time (days)</span>
          <input
            type="number"
            name="defaultLeadTimeDays"
            min={1}
            defaultValue={settings.defaultLeadTimeDays}
            className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[13px] text-greige">Default price tier</span>
          <input
            type="text"
            name="defaultPriceTier"
            defaultValue={settings.defaultPriceTier ?? ""}
            placeholder="standard"
            className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[13px] text-greige">
            Base price hint (PKR paisa, optional)
          </span>
          <input
            type="number"
            name="basePriceHintMinor"
            min={0}
            defaultValue={settings.basePriceHintMinor ?? ""}
            placeholder="e.g. 1250000"
            className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
          />
          {settings.basePriceHintMinor != null ? (
            <span className="text-[12px] text-chalk">
              Current hint:{" "}
              <Money value={settings.basePriceHintMinor} currency="PKR" />
            </span>
          ) : null}
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-4 border border-indigo-lift p-4">
        <legend className="px-1 font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
          fal.ai model routing
        </legend>
        <p className="text-[12px] text-chalk">
          Model ids are configuration — routing is never AI-decided. Pricing
          verified 2026-07-25 on fal.ai model pages.
        </p>
        <div className="flex flex-col gap-3">
          {AI_JOBS.map((job) => (
            <label key={job} className="flex flex-col gap-1">
              <span className="text-[13px] capitalize text-greige">{job}</span>
              <input
                type="text"
                name={`model_${job}`}
                defaultValue={settings.defaultAiModels[job]}
                className="border border-indigo-lift bg-indigo px-2 py-1.5 font-data text-[12px] text-greige"
              />
              <span className="text-[11px] text-chalk">
                Est. ~{formatUsdMicros(estimatedCostUsdMicros[job])} / 1024²
                image
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4 border border-indigo-lift p-4">
        <legend className="px-1 font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
          Prompt template &amp; spend
        </legend>

        <label className="flex flex-col gap-1">
          <span className="text-[13px] text-greige">
            Active prompt template version
          </span>
          <select
            name="activePromptTemplateVersion"
            defaultValue={settings.activePromptTemplateVersion}
            className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
          >
            {templateVersions.map((v) => (
              <option key={v} value={v}>
                v{v}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[13px] text-greige">
            Monthly spend cap (USD cents)
          </span>
          <input
            type="number"
            name="monthlySpendCapUsdCents"
            min={0}
            defaultValue={settings.monthlySpendCapUsdCents ?? ""}
            placeholder="50000 = $500"
            className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
          />
        </label>
      </fieldset>

      {error ? (
        <p className="text-[13px] text-madder" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="text-[13px] text-zari">Saved.</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start border border-zari px-4 py-2 text-[13px] text-zari disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save studio defaults"}
      </button>
    </form>
  );
}
