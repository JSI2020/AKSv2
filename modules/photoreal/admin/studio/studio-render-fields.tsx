"use client";

import { useMemo, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { STUDIO_BACKGROUND_PRESETS } from "@/modules/designs/studio-backgrounds";
import { COMMERCIAL_POSES } from "../../commercial-poses";
import { INPUT_SOURCE_TABS, type PromptMode } from "../../prompt-builder";

import {
  studioFieldClass,
  studioHintClass,
  studioLabelClass,
} from "./studio-primitives";

const POSE_CATEGORIES = [
  "Standing",
  "Walking",
  "Seated",
  "Editorial",
  "Detail",
  "Back",
] as const;

export function SourceModePicker({
  value,
  onChange,
  disabled,
}: {
  value: PromptMode;
  onChange: (mode: PromptMode) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="grid grid-cols-1 gap-0 sm:grid-cols-3"
      role="radiogroup"
      aria-label="Starting point"
    >
      {INPUT_SOURCE_TABS.map((tab, index) => {
        const selected = value === tab.id;
        const [num, ...rest] = tab.label.split("·").map((s) => s.trim());
        const title = rest.join("·") || tab.label;
        return (
          <button
            key={tab.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(tab.id)}
            className={cn(
              "group relative border-b border-indigo-lift py-4 text-start transition sm:border-b-0 sm:border-e sm:px-4 sm:first:ps-0 sm:last:border-e-0 sm:last:pe-0",
              selected ? "text-greige" : "text-chalk/55 hover:text-chalk",
            )}
          >
            <span className="flex items-baseline gap-2">
              <span
                className={cn(
                  "font-mono text-[11px] tabular-nums",
                  selected ? "text-zari" : "text-chalk/45",
                )}
              >
                {num ?? index + 1}
              </span>
              <span className="text-[13.5px] font-medium">{title}</span>
            </span>
            <span className="mt-1.5 block ps-5 text-[11px] leading-snug text-chalk/80 group-hover:text-chalk">
              {tab.hint}
            </span>
            {selected && (
              <span className="absolute inset-inline-start-0 inset-inline-end-0 -bottom-px hidden h-px bg-zari sm:block" />
            )}
          </button>
        );
      })}
    </div>
  );
}

export function PoseSelect({
  id = "studio-pose",
  value,
  onChange,
  disabled,
  hint,
}: {
  id?: string;
  value: string;
  onChange: (poseId: string) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const grouped = useMemo(() => {
    return POSE_CATEGORIES.map((category) => ({
      category,
      poses: COMMERCIAL_POSES.filter((p) => p.category === category),
    })).filter((g) => g.poses.length > 0);
  }, []);

  return (
    <div>
      <label className={studioLabelClass} htmlFor={id}>
        Pose
      </label>
      <select
        id={id}
        className={studioFieldClass}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Random each render (recommended)</option>
        {grouped.map(({ category, poses }) => (
          <optgroup key={category} label={category}>
            {poses.map((pose) => (
              <option key={pose.id} value={pose.id}>
                {pose.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {hint && <p className={studioHintClass}>{hint}</p>}
    </div>
  );
}

export function BackgroundSelect({
  presetId,
  custom,
  onPresetChange,
  onCustomChange,
  disabled,
  idPrefix = "studio-bg",
}: {
  presetId: string;
  custom: string;
  onPresetChange: (presetId: string) => void;
  onCustomChange: (custom: string) => void;
  disabled?: boolean;
  idPrefix?: string;
}) {
  const hasCustom = Boolean(custom.trim());

  return (
    <div className="space-y-4">
      <div>
        <label className={studioLabelClass} htmlFor={`${idPrefix}-preset`}>
          Background
        </label>
        <select
          id={`${idPrefix}-preset`}
          className={studioFieldClass}
          value={presetId}
          disabled={disabled || hasCustom}
          onChange={(e) => onPresetChange(e.target.value)}
        >
          {STUDIO_BACKGROUND_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={studioLabelClass} htmlFor={`${idPrefix}-custom`}>
          Custom background
        </label>
        <input
          id={`${idPrefix}-custom`}
          className={studioFieldClass}
          placeholder="optional — courtyard, foyer, garden…"
          value={custom}
          disabled={disabled}
          onChange={(e) => onCustomChange(e.target.value)}
        />
        <p className={studioHintClass}>
          Overrides the preset when filled. Real location photography only.
        </p>
      </div>
    </div>
  );
}

export function StudioActions({
  children,
  meta,
}: {
  children: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className="mt-8 border-t border-indigo-lift pt-6">
      {meta && <div className="mb-4 text-[11px] text-chalk">{meta}</div>}
      <div className="flex flex-wrap items-center gap-5">{children}</div>
    </div>
  );
}
