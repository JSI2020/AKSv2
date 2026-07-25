"use client";

import { useState, useTransition } from "react";

import { Money } from "@/modules/ui";

import { saveStudioSettings, type StudioSettingsFormData } from "./actions";

type Props = StudioSettingsFormData;

const SIZE_LABELS = ["XS", "S", "M", "L", "XL", "XXL"] as const;

export function StudioSettingsForm({
  settings,
  archetypes,
  templateVersions,
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
          AI models (placeholders)
        </legend>
        <p className="text-[12px] text-chalk">
          fal model ids resolve in Step 36. Use placeholders until then.
        </p>
        <input
          type="hidden"
          name="defaultAiModels"
          value={JSON.stringify(settings.defaultAiModels)}
        />
        <dl className="grid gap-2">
          {(["hero", "angle", "colourway", "draft"] as const).map((job) => (
            <div
              key={job}
              className="flex items-baseline justify-between gap-4 border-b border-indigo-lift/50 pb-2"
            >
              <dt className="text-[13px] capitalize text-greige">{job}</dt>
              <dd className="font-data text-[12px] text-chalk">
                {settings.defaultAiModels[job]}
              </dd>
            </div>
          ))}
        </dl>
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
