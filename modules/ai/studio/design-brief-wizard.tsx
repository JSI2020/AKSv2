"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { buildSketchToPhotoPrompt } from "@/modules/ai/prompts";
import { cn } from "@/lib/utils";

import {
  getDuplicateBriefSource,
  listBriefArchetypes,
  listBriefFabrics,
  listBriefFitProfiles,
  saveDesignBrief,
  type DesignBriefFormData,
} from "./brief-actions";
import {
  briefReadyToGenerate,
  briefReadyToSave,
  buildBriefChecklist,
  firstIncompleteHint,
} from "./brief-checklist";
import { formatDesignBriefName, parseDesignBriefName } from "./brief-name";
import {
  mergeBriefInheritedDefaults,
  type BriefInheritedDefaults,
} from "./brief-defaults";
import {
  InlineArchetypeCreateDialog,
  InlineFabricCreateDialog,
  InlineFitProfileCreateDialog,
} from "./inline-create-dialog";
import { SearchableSelect } from "./searchable-select";

const SESSION_KEY = "aks-studio-brief-session";

type SessionOverrides = Partial<{
  archetypeId: string;
  sizeBlockId: string;
  fitProfileId: string;
  occasionTag: string;
  seasonTag: string;
  workTag: string;
  backdrop: string;
  garmentDescription: string;
  fabricId: string;
  colourwayName: string;
}>;

function loadSessionOverrides(): SessionOverrides {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SessionOverrides) : {};
  } catch {
    return {};
  }
}

function saveSessionOverrides(overrides: SessionOverrides) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(overrides));
}

const fieldClass =
  "border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige outline-none focus:border-zari w-full";

type BriefState = DesignBriefFormData["inherited"] & {
  name: string;
  nameEdited: boolean;
  description: string;
  notes: string;
  fabricId: string;
  colourwayName: string;
  colourwayHex: string;
  combinationBrief: string;
  promptEdited: boolean;
};

function initState(data: DesignBriefFormData, session: SessionOverrides): BriefState {
  const inherited = { ...data.inherited, ...session };
  const fabric = data.options.fabrics.find((f) => f.id === (session.fabricId ?? ""));
  if (fabric) {
    inherited.shirtFabric = fabric.name;
    inherited.trouserFabric = fabric.name;
  }
  return {
    ...inherited,
    name: data.suggestedName,
    nameEdited: false,
    description: "",
    notes: "",
    fabricId: session.fabricId ?? "",
    colourwayName: session.colourwayName ?? inherited.shirtColour,
    colourwayHex: "",
    combinationBrief: "",
    promptEdited: false,
  };
}

export function DesignBriefWizard({ data }: { data: DesignBriefFormData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [options, setOptions] = useState(data.options);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [state, setState] = useState<BriefState>(() =>
    initState(data, {}),
  );

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [fabricDialog, setFabricDialog] = useState(false);
  const [archetypeDialog, setArchetypeDialog] = useState(false);
  const [fitDialog, setFitDialog] = useState(false);

  const inheritedBaseline = useMemo(
    () =>
      mergeBriefInheritedDefaults({
        studio: data.studio,
        collection: data.collection,
        options,
        categoryId: state.garmentTypeId,
        fabricName: options.fabrics.find((f) => f.id === state.fabricId)?.name,
        colourName: state.colourwayName,
      }),
    [data.collection, data.studio, options, state.fabricId, state.colourwayName, state.garmentTypeId],
  );

  useEffect(() => {
    const session = loadSessionOverrides();
    setState(initState(data, session));
    setSessionLoaded(true);
  }, [data]);

  const patch = useCallback((partial: Partial<BriefState>) => {
    setState((prev) => {
      const next = { ...prev, ...partial };
      if ("fabricId" in partial || "colourwayName" in partial) {
        const fabric = options.fabrics.find((f) => f.id === next.fabricId);
        if (fabric) {
          next.shirtFabric = fabric.name;
          next.trouserFabric = fabric.name;
        }
        if (partial.colourwayName) {
          next.shirtColour = partial.colourwayName;
          next.trouserColour = partial.colourwayName;
        }
      }
      if ("garmentTypeId" in partial && !prev.nameEdited) {
        const cat = options.categories.find((c) => c.id === next.garmentTypeId);
        if (cat) {
          const parsed = parseDesignBriefName(prev.name);
          const year = parsed?.year ?? new Date().getFullYear();
          const seq = parsed?.seq ?? 1;
          next.name = formatDesignBriefName(cat.key, year, seq);
          next.categoryKey = cat.key;
        }
      }
      return next;
    });
  }, [options.categories, options.fabrics]);

  useEffect(() => {
    if (!sessionLoaded) return;
    saveSessionOverrides({
      archetypeId: state.archetypeId,
      sizeBlockId: state.sizeBlockId,
      fitProfileId: state.fitProfileId,
      occasionTag: state.occasionTag,
      seasonTag: state.seasonTag,
      workTag: state.workTag,
      backdrop: state.backdrop,
      garmentDescription: state.garmentDescription,
      fabricId: state.fabricId,
      colourwayName: state.colourwayName,
    });
  }, [sessionLoaded, state]);

  const selectedArchetype = options.archetypes.find((a) => a.id === state.archetypeId);

  const assembled = useMemo(() => {
    if (!selectedArchetype) {
      return { prompt: "", negative: "", templateVersion: data.templateVersion };
    }
    return buildSketchToPhotoPrompt(
      {
        garmentDescription: state.garmentDescription,
        shirtColour: state.shirtColour,
        shirtFabric: state.shirtFabric,
        trouserColour: state.trouserColour,
        trouserFabric: state.trouserFabric,
        embroideryDescription: state.embroideryDescription,
        angle: "FRONT",
        houseModel: {
          buildDescription: selectedArchetype.buildDescription,
          heightCm: selectedArchetype.heightCm,
          heightInches: selectedArchetype.heightInches,
        },
        backdrop: state.backdrop,
      },
      data.templateVersion as 1,
    );
  }, [data.templateVersion, selectedArchetype, state]);

  const promptText = state.promptEdited
    ? state.combinationBrief
    : assembled.prompt;

  const checklist = buildBriefChecklist({
    fabricId: state.fabricId,
    colourwayName: state.colourwayName,
    garmentTypeId: state.garmentTypeId,
    archetypeId: state.archetypeId,
    garmentDescription: state.garmentDescription,
    shirtFabric: state.shirtFabric,
    shirtColour: state.shirtColour,
    hasSketch: false,
  });

  const canSave = briefReadyToSave(checklist);
  const canGenerate = briefReadyToGenerate(checklist);
  const blockHint = firstIncompleteHint(checklist);

  function isInherited(field: keyof BriefInheritedDefaults): boolean {
    const baseline = inheritedBaseline[field];
    return state[field] === baseline;
  }

  function handleDuplicate(designId: string) {
    startTransition(async () => {
      const source = await getDuplicateBriefSource(designId);
      if (!source) return;
      patch({
        ...source,
        name: data.suggestedName,
        nameEdited: false,
        notes: source.notes,
        description: source.description,
        fabricId: source.fabricId,
        colourwayName: source.colourwayName,
        promptEdited: false,
        combinationBrief: "",
      });
    });
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const res = await saveDesignBrief({
        name: state.name,
        description: state.description,
        notes: state.notes,
        garmentTypeId: state.garmentTypeId,
        archetypeId: state.archetypeId,
        sizeBlockId: state.sizeBlockId,
        fitProfileId: state.fitProfileId,
        occasionTag: state.occasionTag,
        seasonTag: state.seasonTag,
        workTag: state.workTag,
        baseSizeLabel: state.baseSizeLabel,
        backdrop: state.backdrop,
        garmentDescription: state.garmentDescription,
        shirtColour: state.shirtColour,
        shirtFabric: state.shirtFabric,
        trouserColour: state.trouserColour,
        trouserFabric: state.trouserFabric,
        embroideryDescription: state.embroideryDescription,
        fabricId: state.fabricId,
        colourwayName: state.colourwayName,
        colourwayHex: state.colourwayHex || null,
        combinationBrief: state.promptEdited ? state.combinationBrief : null,
        templateVersion: data.templateVersion,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/admin/designs/${res.id}`);
      router.refresh();
    });
  }

  const categoryOptions = options.categories.map((c) => ({
    value: c.id,
    label: `${c.key} — ${c.name}`,
  }));

  const fabricOptions = options.fabrics.map((f) => ({
    value: f.id,
    label: f.name,
    hint: f.composition,
  }));

  const colourOptions = [
    ...options.colourPresets.map((c) => ({
      value: c.name,
      label: c.name,
      hint: c.hex ?? undefined,
    })),
    ...(state.colourwayName &&
    !options.colourPresets.some((c) => c.name === state.colourwayName)
      ? [{ value: state.colourwayName, label: state.colourwayName }]
      : []),
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_240px]">
      <div className="flex flex-col gap-4">
        {data.collection ? (
          <p className="text-[12px] text-chalk">
            Collection context:{" "}
            <span className="text-greige">{data.collection.label}</span>
          </p>
        ) : null}

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[220px] flex-1 flex-col gap-1">
            <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
              Design name
            </span>
            <input
              value={state.name}
              onChange={(e) =>
                patch({ name: e.target.value, nameEdited: true })
              }
              className={fieldClass}
            />
          </label>

          <SearchableSelect
            label="Duplicate from…"
            options={data.duplicateSources.map((d) => ({
              value: d.id,
              label: d.name,
              hint: d.categoryKey,
            }))}
            value=""
            onChange={handleDuplicate}
            placeholder="Clone a previous brief"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <SearchableSelect
            label="Fabric"
            options={fabricOptions}
            value={state.fabricId}
            onChange={(fabricId) => patch({ fabricId })}
            onAddNew={() => setFabricDialog(true)}
          />
          <SearchableSelect
            label="Base colour"
            options={colourOptions}
            value={state.colourwayName}
            onChange={(colourwayName) => patch({ colourwayName })}
            placeholder="Ivory"
          />
        </div>

        <div className="border border-indigo-lift bg-indigo/40 px-3 py-2 text-[12px] text-chalk">
          Sketch upload deferred to step 38 — save the brief now, add sketches
          next.
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <SearchableSelect
            label="Category"
            options={categoryOptions}
            value={state.garmentTypeId}
            onChange={(garmentTypeId) => {
              const cat = options.categories.find((c) => c.id === garmentTypeId);
              const merged = mergeBriefInheritedDefaults({
                studio: data.studio,
                collection: data.collection,
                options,
                categoryId: garmentTypeId,
              });
              patch({
                garmentTypeId,
                categoryKey: cat?.key ?? merged.categoryKey,
                sizeBlockId: merged.sizeBlockId,
                fitProfileId: merged.fitProfileId,
                garmentDescription: merged.garmentDescription,
              });
            }}
            inherited={isInherited("garmentTypeId")}
          />
          <SearchableSelect
            label="House model"
            options={options.archetypes.map((a) => ({
              value: a.id,
              label: a.name,
            }))}
            value={state.archetypeId}
            onChange={(archetypeId) => patch({ archetypeId })}
            inherited={isInherited("archetypeId")}
            onAddNew={() => setArchetypeDialog(true)}
          />
        </div>

        <label className="flex flex-col gap-1">
          <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
            Description
          </span>
          <textarea
            value={state.description}
            onChange={(e) => patch({ description: e.target.value })}
            rows={2}
            className={fieldClass}
          />
        </label>

        <details
          open={advancedOpen}
          onToggle={(e) => setAdvancedOpen(e.currentTarget.open)}
          className="border border-indigo-lift"
        >
          <summary className="cursor-pointer px-3 py-2 text-[13px] text-zari">
            Advanced
          </summary>
          <div className="flex flex-col gap-3 border-t border-indigo-lift p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <SearchableSelect
                label="Size block"
                options={options.blocks
                  .filter((b) => b.categoryId === state.garmentTypeId)
                  .map((b) => ({ value: b.id, label: b.name, hint: b.categoryKey }))}
                value={state.sizeBlockId}
                onChange={(sizeBlockId) => patch({ sizeBlockId })}
                inherited={isInherited("sizeBlockId")}
              />
              <SearchableSelect
                label="Fit profile"
                options={options.profiles
                  .filter((p) => p.categoryId === state.garmentTypeId)
                  .map((p) => ({ value: p.id, label: p.name, hint: p.categoryKey }))}
                value={state.fitProfileId}
                onChange={(fitProfileId) => patch({ fitProfileId })}
                inherited={isInherited("fitProfileId")}
                onAddNew={() => setFitDialog(true)}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <SearchableSelect
                label="Occasion"
                options={options.tagOptions.occasion.map((v) => ({
                  value: v,
                  label: v.replace(/_/g, " "),
                }))}
                value={state.occasionTag}
                onChange={(occasionTag) => patch({ occasionTag })}
                inherited={isInherited("occasionTag")}
              />
              <SearchableSelect
                label="Season"
                options={options.tagOptions.season.map((v) => ({
                  value: v,
                  label: v.replace(/_/g, " "),
                }))}
                value={state.seasonTag}
                onChange={(seasonTag) => patch({ seasonTag })}
                inherited={isInherited("seasonTag")}
              />
              <SearchableSelect
                label="Work type"
                options={options.tagOptions.work.map((v) => ({
                  value: v,
                  label: v.replace(/_/g, " "),
                }))}
                value={state.workTag}
                onChange={(workTag) => patch({ workTag })}
                inherited={isInherited("workTag")}
              />
            </div>

            <label className="flex flex-col gap-1">
              <span
                className={cn(
                  "font-sans text-[11px] uppercase tracking-[0.12em] text-chalk",
                  isInherited("garmentDescription") && "opacity-60",
                )}
              >
                Garment description
              </span>
              <textarea
                value={state.garmentDescription}
                onChange={(e) =>
                  patch({ garmentDescription: e.target.value })
                }
                rows={2}
                className={cn(fieldClass, isInherited("garmentDescription") && "opacity-60")}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span
                className={cn(
                  "font-sans text-[11px] uppercase tracking-[0.12em] text-chalk",
                  isInherited("backdrop") && "opacity-60",
                )}
              >
                Backdrop & lighting
              </span>
              <input
                value={state.backdrop}
                onChange={(e) => patch({ backdrop: e.target.value })}
                className={cn(fieldClass, isInherited("backdrop") && "opacity-60")}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
                Embroidery
              </span>
              <input
                value={state.embroideryDescription}
                onChange={(e) =>
                  patch({ embroideryDescription: e.target.value })
                }
                className={fieldClass}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
                Notes
              </span>
              <textarea
                value={state.notes}
                onChange={(e) => patch({ notes: e.target.value })}
                rows={2}
                className={fieldClass}
              />
            </label>

            <p className="text-[11px] text-chalk">
              Price, fabric metres, lead time, SEO and tags are set at the
              publish gate — not required here.
            </p>
          </div>
        </details>

        <details
          open={promptOpen}
          onToggle={(e) => setPromptOpen(e.currentTarget.open)}
          className="border border-indigo-lift"
        >
          <summary className="cursor-pointer px-3 py-2 text-[13px] text-zari">
            Assembled prompt
          </summary>
          <div className="border-t border-indigo-lift p-3">
            <textarea
              value={promptText}
              onChange={(e) =>
                patch({
                  combinationBrief: e.target.value,
                  promptEdited: true,
                })
              }
              rows={6}
              className={fieldClass}
            />
            <p className="mt-2 text-[11px] text-chalk">
              Negative: {assembled.negative}
            </p>
          </div>
        </details>

        {error ? (
          <p className="text-[13px] text-madder" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending || !canSave}
            onClick={handleSave}
            className="border border-zari bg-zari px-3 py-1.5 text-[13px] text-indigo disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save draft brief"}
          </button>
          <button
            type="button"
            disabled
            title={blockHint ?? undefined}
            className="border border-indigo-lift px-3 py-1.5 text-[13px] text-chalk opacity-50"
          >
            Generate hero
          </button>
          {!canGenerate && blockHint ? (
            <span className="self-center text-[12px] text-chalk">{blockHint}</span>
          ) : null}
        </div>
      </div>

      <aside className="border border-indigo-lift p-3">
        <h2 className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
          Brief checklist
        </h2>
        <ul className="mt-3 flex flex-col gap-2">
          {checklist.map((item) => (
            <li
              key={item.id}
              className={cn(
                "flex items-start gap-2 text-[12px]",
                item.done ? "text-greige" : "text-chalk",
              )}
            >
              <span aria-hidden>{item.done ? "✓" : "○"}</span>
              <span>
                {item.label}
                {!item.done && item.required ? (
                  <span className="block text-[11px] text-chalk/80">
                    {item.hint}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </aside>

      <InlineFabricCreateDialog
        open={fabricDialog}
        onClose={() => setFabricDialog(false)}
        onCreated={async (id, name) => {
          const rows = await listBriefFabrics();
          setOptions((prev) => ({ ...prev, fabrics: rows }));
          patch({ fabricId: id, shirtFabric: name, trouserFabric: name });
        }}
      />
      <InlineArchetypeCreateDialog
        open={archetypeDialog}
        onClose={() => setArchetypeDialog(false)}
        onCreated={async (id, name) => {
          const rows = await listBriefArchetypes();
          setOptions((prev) => ({ ...prev, archetypes: rows }));
          const match = rows.find((r) => r.id === id || r.name === name);
          if (match) patch({ archetypeId: match.id });
        }}
      />
      <InlineFitProfileCreateDialog
        open={fitDialog}
        onClose={() => setFitDialog(false)}
        categoryId={state.garmentTypeId}
        onCreated={async () => {
          const rows = await listBriefFitProfiles();
          setOptions((prev) => ({ ...prev, profiles: rows }));
          const latest = rows.filter((r) => r.categoryId === state.garmentTypeId).at(-1);
          if (latest) patch({ fitProfileId: latest.id });
        }}
      />
    </div>
  );
}
