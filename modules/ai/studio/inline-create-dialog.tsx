"use client";

import { useState, useTransition, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { uuidv7 } from "@aks/shared";
import { saveFabric, saveHouseModel } from "@/modules/sizing/fabric-archetype-actions";
import { createFitProfile } from "@/modules/sizing/fit-profile-actions";

type DialogShellProps = {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

function DialogShell({ title, open, onClose, children }: DialogShellProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md border border-indigo-lift bg-indigo p-4 text-greige"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-xl text-greige">{title}</h2>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}

const fieldClass =
  "border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige outline-none focus:border-zari w-full";

export function InlineFabricCreateDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string, name: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <DialogShell title="New fabric" open={open} onClose={onClose}>
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const fd = new FormData(e.currentTarget);
          const id = uuidv7();
          fd.set("id", id);
          startTransition(async () => {
            const res = await saveFabric(fd);
            if (!res.ok) {
              setError(res.error);
              return;
            }
            onCreated(id, String(fd.get("name") ?? ""));
            onClose();
          });
        }}
      >
        <label className="flex flex-col gap-1 text-[12px] text-chalk">
          Name
          <input name="name" required className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-chalk">
          Composition
          <input name="composition" required className={fieldClass} defaultValue="Cotton blend" />
        </label>
        <input type="hidden" name="widthInches" value="4400" />
        <input type="hidden" name="stretchPercent" value="0" />
        <input type="hidden" name="shrinkageAllowance" value="0" />
        <input type="hidden" name="costPerMeterMinor" value="0" />
        <input type="hidden" name="drapeClass" value="MEDIUM" />
        {error ? (
          <p className="text-[12px] text-madder" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending} className="bg-zari text-indigo">
            {pending ? "Saving…" : "Create"}
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}

export function InlineFitProfileCreateDialog({
  open,
  onClose,
  categoryId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  categoryId: string;
  onCreated: (id: string, name: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <DialogShell title="New fit profile" open={open} onClose={onClose}>
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const fd = new FormData(e.currentTarget);
          fd.set("categoryId", categoryId);
          fd.set("easeByMeasurement", "{}");
          fd.set("clingFactorBps", "0");
          fd.set("sortOrder", "100");
          startTransition(async () => {
            const res = await createFitProfile(fd);
            if (!res.ok) {
              setError(res.error);
              return;
            }
            onCreated("", String(fd.get("name") ?? ""));
            onClose();
          });
        }}
      >
        <label className="flex flex-col gap-1 text-[12px] text-chalk">
          Name
          <input name="name" required className={fieldClass} />
        </label>
        {error ? (
          <p className="text-[12px] text-madder" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending} className="bg-zari text-indigo">
            {pending ? "Saving…" : "Create"}
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}

export function InlineArchetypeCreateDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string, name: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <DialogShell title="New house model" open={open} onClose={onClose}>
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const fd = new FormData(e.currentTarget);
          const id = uuidv7();
          fd.set("id", id);
          fd.set("isAiGenerated", "true");
          fd.set("heightCm", "165");
          fd.set("heightInches", "6500");
          fd.set("bust", "3600");
          fd.set("waist", "2800");
          fd.set("hip", "3800");
          fd.set("shoulder", "1500");
          fd.set("wearsSizeLabel", "M");
          fd.set("identitySeed", String(Date.now()));
          startTransition(async () => {
            const res = await saveHouseModel(fd);
            if (!res.ok) {
              setError(res.error);
              return;
            }
            onCreated(id, String(fd.get("name") ?? ""));
            onClose();
          });
        }}
      >
        <label className="flex flex-col gap-1 text-[12px] text-chalk">
          Name
          <input name="name" required className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-chalk">
          Build description
          <textarea
            name="buildDescription"
            rows={2}
            className={fieldClass}
            defaultValue="South Asian house model archetype."
          />
        </label>
        {error ? (
          <p className="text-[12px] text-madder" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending} className="bg-zari text-indigo">
            {pending ? "Saving…" : "Create"}
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}
