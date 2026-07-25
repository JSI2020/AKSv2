export type BriefChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  hint: string;
  required: boolean;
};

export type BriefChecklistInput = {
  fabricId: string;
  colourwayName: string;
  garmentTypeId: string;
  archetypeId: string;
  garmentDescription: string;
  shirtFabric: string;
  shirtColour: string;
  /** Sketch deferred to step 38 — shown but not required for save. */
  hasSketch?: boolean;
};

export function buildBriefChecklist(
  input: BriefChecklistInput,
): BriefChecklistItem[] {
  return [
    {
      id: "fabric",
      label: "Fabric",
      done: Boolean(input.fabricId),
      hint: "Pick a fabric to continue",
      required: true,
    },
    {
      id: "colourway",
      label: "Base colour",
      done: Boolean(input.colourwayName.trim()),
      hint: "Pick a base colour to continue",
      required: true,
    },
    {
      id: "category",
      label: "Category",
      done: Boolean(input.garmentTypeId),
      hint: "Choose a garment category",
      required: true,
    },
    {
      id: "archetype",
      label: "House model",
      done: Boolean(input.archetypeId),
      hint: "Choose a house model archetype",
      required: true,
    },
    {
      id: "garment",
      label: "Garment description",
      done: Boolean(input.garmentDescription.trim()),
      hint: "Add a garment description for the prompt",
      required: true,
    },
    {
      id: "prompt-fabric",
      label: "Prompt fabric & colour",
      done: Boolean(input.shirtFabric.trim() && input.shirtColour.trim()),
      hint: "Fabric and colour feed the generation prompt",
      required: true,
    },
    {
      id: "sketch",
      label: "Sketch",
      done: Boolean(input.hasSketch),
      hint: "Add a sketch in the next step to generate",
      required: false,
    },
  ];
}

export function briefReadyToSave(items: BriefChecklistItem[]): boolean {
  return items.filter((i) => i.required).every((i) => i.done);
}

export function briefReadyToGenerate(items: BriefChecklistItem[]): boolean {
  return items.every((i) => i.done);
}

export function firstIncompleteHint(items: BriefChecklistItem[]): string | null {
  const pending = items.find((i) => !i.done);
  return pending?.hint ?? null;
}
