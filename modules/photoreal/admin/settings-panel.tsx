"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

import {
  getPhotorealSettingsAction,
  savePhotorealSettingsAction,
} from "../actions";
import { FAL_MODEL_OPTIONS, type FalModelKey } from "../fal-config";
import {
  HOUSE_MODELS,
  RANDOM_HOUSE_MODEL_ID,
} from "../model-persona";
import type { AppSettings } from "../settings";

type SettingsPanelProps = {
  open: boolean;
  onClose: () => void;
  onSaved?: (settings: AppSettings) => void;
};

const MODEL_KEYS = Object.keys(FAL_MODEL_OPTIONS) as FalModelKey[];
const fieldClass =
  "h-9 w-full border border-indigo-lift bg-indigo px-3 text-[13px] text-greige rounded-[2px]";

export function SettingsPanel({ open, onClose, onSaved }: SettingsPanelProps) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMessage(null);
    void getPhotorealSettingsAction()
      .then((data) => {
        if (!data.ok) throw new Error(data.error);
        setSettings({
          persona: data.persona,
          preferredHouseModelId: data.preferredHouseModelId,
          fal: data.fal,
          monthlySpendReminderUsd: data.monthlySpendReminderUsd,
        });
      })
      .catch((err: unknown) => {
        setMessage(
          err instanceof Error ? err.message : "Failed to load settings.",
        );
      });
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40">
      <button
        type="button"
        className="flex-1 cursor-default"
        aria-label="Close settings"
        onClick={onClose}
      />
      <aside className="flex h-full w-full max-w-md flex-col border-s border-indigo-lift bg-indigo">
        <div className="flex items-center justify-between border-b border-indigo-lift px-5 py-4">
          <h2 className="font-display text-xl text-greige">Settings</h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-[2px] text-[13px] text-chalk"
            onClick={onClose}
          >
            Close
          </Button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {!settings ? (
            <p className="text-[13px] text-chalk">Loading…</p>
          ) : (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-[13px] text-greige">
                  Default catalogue model
                </span>
                <select
                  className={fieldClass}
                  value={settings.preferredHouseModelId}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      preferredHouseModelId: e.target.value,
                    })
                  }
                >
                  <option value={RANDOM_HOUSE_MODEL_ID}>
                    Random each new design
                  </option>
                  {HOUSE_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} — {m.cue}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-chalk">
                  Override per design on the input screen. Refine keeps the same
                  model.
                </span>
              </label>

              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[13px] text-greige">Lock seed</p>
                  <p className="text-[11px] text-chalk">
                    Locked = consistent face within a design
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.persona.lockSeed}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      persona: {
                        ...settings.persona,
                        lockSeed: e.target.checked,
                      },
                    })
                  }
                  className="size-4 accent-zari"
                />
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-[13px] text-greige">Generation model</span>
                <select
                  className={fieldClass}
                  value={settings.fal.generateModel}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      fal: {
                        ...settings.fal,
                        generateModel: e.target.value as FalModelKey,
                      },
                    })
                  }
                >
                  {MODEL_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {FAL_MODEL_OPTIONS[key].label} (~$
                      {FAL_MODEL_OPTIONS[key].estimatedCostUsd.toFixed(3)})
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[13px] text-greige">Refinement model</span>
                <select
                  className={fieldClass}
                  value={settings.fal.refineModel}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      fal: {
                        ...settings.fal,
                        refineModel: e.target.value as FalModelKey,
                      },
                    })
                  }
                >
                  {MODEL_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {FAL_MODEL_OPTIONS[key].label} (~$
                      {FAL_MODEL_OPTIONS[key].estimatedCostUsd.toFixed(3)})
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[13px] text-greige">
                  Monthly spend reminder (USD)
                </span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  placeholder="optional"
                  className={fieldClass}
                  value={settings.monthlySpendReminderUsd ?? ""}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      monthlySpendReminderUsd: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                />
              </label>
            </>
          )}
        </div>

        <div className="border-t border-indigo-lift px-5 py-4">
          {message && (
            <p className="mb-2 text-[11px] text-chalk">{message}</p>
          )}
          <Button
            type="button"
            className="w-full rounded-[2px] border border-zari bg-transparent text-[13px] text-zari hover:bg-indigo-lift"
            disabled={!settings || saving}
            onClick={() => {
              if (!settings) return;
              setSaving(true);
              setMessage(null);
              void savePhotorealSettingsAction(settings)
                .then((res) => {
                  if (!res.ok) throw new Error(res.error);
                  setMessage("Saved — next generation will use these settings.");
                  onSaved?.(settings);
                })
                .catch((err: unknown) => {
                  setMessage(
                    err instanceof Error ? err.message : "Failed to save.",
                  );
                })
                .finally(() => setSaving(false));
            }}
          >
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </aside>
    </div>
  );
}
