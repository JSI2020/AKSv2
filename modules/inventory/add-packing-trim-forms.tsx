"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createPackingMaterial, createTrim } from "./packing-trim-actions";
import { pkrToPaisa, TRIM_KINDS, type TrimKind } from "./packing-trim-shared";

function fieldClass() {
  return "border border-ink/12 bg-greige/30 px-3 py-2 text-[13px] text-ink outline-none focus:border-ink";
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-sans text-[10px] uppercase tracking-[0.14em] text-ink/55">
      {children}
    </span>
  );
}

export function AddPackingMaterialForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [reorder, setReorder] = useState("0");
  const [opening, setOpening] = useState("0");
  const [costPkr, setCostPkr] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    const reorderPoint = Number.parseInt(reorder, 10);
    const openingQty = Number.parseInt(opening, 10);
    const cost = pkrToPaisa(costPkr);
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (
      !Number.isInteger(reorderPoint) ||
      reorderPoint < 0 ||
      !Number.isInteger(openingQty) ||
      openingQty < 0 ||
      cost === null
    ) {
      setError("Use whole numbers ≥ 0 for qty and cost (PKR)");
      return;
    }
    startTransition(async () => {
      const res = await createPackingMaterial({
        name,
        reorderPoint,
        openingQty,
        costPerUnitMinor: cost,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      setName("");
      setReorder("0");
      setOpening("0");
      setCostPkr("0");
      router.refresh();
      router.push(`/admin/inventory/packing/${res.id}`);
    });
  }

  return (
    <div className="border border-ink/12 bg-milk">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-start text-[13px] text-ink hover:bg-greige/30"
      >
        <span className="font-sans text-[11px] uppercase tracking-[0.1em]">
          {open ? "Cancel" : "+ Add packing item"}
        </span>
      </button>
      {open ? (
        <div className="flex flex-col gap-3 border-t border-ink/12 px-4 py-4">
          <label className="flex flex-col gap-1.5">
            <Label>Name</Label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Shipping box — medium"
              className={fieldClass()}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5">
              <Label>Opening qty (pcs)</Label>
              <input
                value={opening}
                onChange={(e) => setOpening(e.target.value)}
                inputMode="numeric"
                className={fieldClass()}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <Label>Reorder at</Label>
              <input
                value={reorder}
                onChange={(e) => setReorder(e.target.value)}
                inputMode="numeric"
                className={fieldClass()}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <Label>Cost / unit (PKR)</Label>
              <input
                value={costPkr}
                onChange={(e) => setCostPkr(e.target.value)}
                inputMode="numeric"
                className={fieldClass()}
              />
            </label>
          </div>
          {error ? (
            <p className="text-[12px] text-madder" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            disabled={pending}
            onClick={submit}
            className="self-start border border-ink bg-ink px-4 py-2 text-[12px] uppercase tracking-[0.08em] text-milk disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save item"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

type ColourDraft = { name: string; hex: string; openingQty: string };

export function AddTrimForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<TrimKind>("BUTTON");
  const [hasColours, setHasColours] = useState(true);
  const [reorder, setReorder] = useState("20");
  const [opening, setOpening] = useState("0");
  const [costPkr, setCostPkr] = useState("0");
  const [colours, setColours] = useState<ColourDraft[]>([
    { name: "", hex: "", openingQty: "0" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    const reorderPoint = Number.parseInt(reorder, 10);
    const cost = pkrToPaisa(costPkr);
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!Number.isInteger(reorderPoint) || reorderPoint < 0 || cost === null) {
      setError("Use whole numbers ≥ 0 for reorder and cost (PKR)");
      return;
    }

    if (hasColours) {
      const parsed = colours
        .map((c) => ({
          name: c.name.trim(),
          hex: c.hex.trim() || undefined,
          openingQty: Number.parseInt(c.openingQty || "0", 10),
        }))
        .filter((c) => c.name);
      if (parsed.length === 0) {
        setError("Add at least one colour");
        return;
      }
      if (parsed.some((c) => !Number.isInteger(c.openingQty) || c.openingQty < 0)) {
        setError("Colour opening qty must be whole numbers ≥ 0");
        return;
      }
      startTransition(async () => {
        const res = await createTrim({
          name,
          kind,
          hasColourVariants: true,
          reorderPoint,
          costPerUnitMinor: cost,
          colours: parsed,
        });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setOpen(false);
        router.refresh();
        router.push(`/admin/inventory/trims/${res.id}`);
      });
      return;
    }

    const openingQty = Number.parseInt(opening, 10);
    if (!Number.isInteger(openingQty) || openingQty < 0) {
      setError("Opening qty must be a whole number ≥ 0");
      return;
    }
    startTransition(async () => {
      const res = await createTrim({
        name,
        kind,
        hasColourVariants: false,
        reorderPoint,
        costPerUnitMinor: cost,
        openingQty,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
      router.push(`/admin/inventory/trims/${res.id}`);
    });
  }

  return (
    <div className="border border-ink/12 bg-milk">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-start text-[13px] text-ink hover:bg-greige/30"
      >
        <span className="font-sans text-[11px] uppercase tracking-[0.1em]">
          {open ? "Cancel" : "+ Add trim"}
        </span>
      </button>
      {open ? (
        <div className="flex flex-col gap-3 border-t border-ink/12 px-4 py-4">
          <label className="flex flex-col gap-1.5">
            <Label>Name</Label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Button — 12mm"
              className={fieldClass()}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <Label>Kind</Label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as TrimKind)}
                className={fieldClass()}
              >
                {TRIM_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k.charAt(0) + k.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <Label>Cost / unit (PKR)</Label>
              <input
                value={costPkr}
                onChange={(e) => setCostPkr(e.target.value)}
                inputMode="numeric"
                className={fieldClass()}
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-[13px] text-ink">
            <input
              type="checkbox"
              checked={hasColours}
              onChange={(e) => setHasColours(e.target.checked)}
              className="size-4 rounded-[2px] border-ink/30"
            />
            Has colour variants
          </label>

          {hasColours ? (
            <div className="flex flex-col gap-2">
              <Label>Colours</Label>
              {colours.map((c, i) => (
                <div
                  key={i}
                  className="grid gap-2 sm:grid-cols-[1fr_5.5rem_5.5rem_auto]"
                >
                  <input
                    value={c.name}
                    onChange={(e) => {
                      const next = [...colours];
                      next[i] = { ...c, name: e.target.value };
                      setColours(next);
                    }}
                    placeholder="Colour name"
                    className={fieldClass()}
                  />
                  <input
                    value={c.hex}
                    onChange={(e) => {
                      const next = [...colours];
                      next[i] = { ...c, hex: e.target.value };
                      setColours(next);
                    }}
                    placeholder="#hex"
                    className={fieldClass()}
                  />
                  <input
                    value={c.openingQty}
                    onChange={(e) => {
                      const next = [...colours];
                      next[i] = { ...c, openingQty: e.target.value };
                      setColours(next);
                    }}
                    placeholder="Qty"
                    inputMode="numeric"
                    className={fieldClass()}
                  />
                  <button
                    type="button"
                    className="text-[12px] text-ink/45 hover:text-madder"
                    onClick={() =>
                      setColours((prev) =>
                        prev.length <= 1 ? prev : prev.filter((_, j) => j !== i),
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="self-start text-[12px] text-ink underline-offset-2 hover:underline"
                onClick={() =>
                  setColours((prev) => [
                    ...prev,
                    { name: "", hex: "", openingQty: "0" },
                  ])
                }
              >
                + Another colour
              </button>
              <label className="flex max-w-[12rem] flex-col gap-1.5">
                <Label>Reorder at (each colour)</Label>
                <input
                  value={reorder}
                  onChange={(e) => setReorder(e.target.value)}
                  inputMode="numeric"
                  className={fieldClass()}
                />
              </label>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <Label>Opening qty (pcs)</Label>
                <input
                  value={opening}
                  onChange={(e) => setOpening(e.target.value)}
                  inputMode="numeric"
                  className={fieldClass()}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <Label>Reorder at</Label>
                <input
                  value={reorder}
                  onChange={(e) => setReorder(e.target.value)}
                  inputMode="numeric"
                  className={fieldClass()}
                />
              </label>
            </div>
          )}

          {error ? (
            <p className="text-[12px] text-madder" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            disabled={pending}
            onClick={submit}
            className="self-start border border-ink bg-ink px-4 py-2 text-[12px] uppercase tracking-[0.08em] text-milk disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save trim"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
