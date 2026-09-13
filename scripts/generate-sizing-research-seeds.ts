/**
 * Reads data/sizing-research/*.csv and writes TypeScript seeds for @aks/shared.
 * Run: npx tsx scripts/generate-sizing-research-seeds.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");
const DATA = join(ROOT, "data", "sizing-research");
const OUT = join(ROOT, "packages", "shared", "sizing-research");

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim().split("\n");
  if (!lines.length) return [];
  const headers = splitCsvLine(lines[0]!);
  return lines.slice(1).filter(Boolean).map((line) => {
    const cols = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? "";
    });
    return row;
  });
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

const SIZE_ORDER = [
  "XXS",
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "3XL",
  "4XL",
  "5XL",
  "6XL",
  "7XL",
] as const;

type BodyOrGarment = "BODY" | "GARMENT";

function inferBodyOrGarment(key: string): BodyOrGarment {
  if (
    /^(BUST|CHEST|WAIST|HIP|THIGH|UPPER_WAIST|LOWER_WAIST|TOP_BUST|TOP_WAIST|TOP_HIP|BOTTOM_WAIST|BOTTOM_HIP|KNEE_ROUND)$/i.test(
      key,
    )
  ) {
    return "BODY";
  }
  return "GARMENT";
}

function anchorForKey(key: string): string {
  const map: Record<string, string> = {
    BUST: "bust_line",
    CHEST: "bust_line",
    WAIST: "waist_line",
    HIP: "hip_line",
    SHOULDER: "shoulder_line",
    LENGTH: "shoulder_line",
    SLEEVE_LENGTH: "shoulder_point",
    WIDTH: "centre",
    FABRIC_LENGTH: "fabric_edge",
    FABRIC_WIDTH: "fabric_edge",
  };
  return map[key] ?? "centre";
}

function labelFromKey(key: string): string {
  return key
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function inches(n: number): number {
  return Math.round(n * 100);
}

function sortSizes(labels: string[]): string[] {
  const set = new Set(labels);
  return SIZE_ORDER.filter((s) => set.has(s));
}

function deriveGradeIncrement(values: Map<string, number>, sizes: string[]): number {
  const steps: number[] = [];
  for (let i = 1; i < sizes.length; i++) {
    const prev = values.get(sizes[i - 1]!);
    const curr = values.get(sizes[i]!);
    if (prev != null && curr != null) steps.push(curr - prev);
  }
  if (!steps.length) return inches(1);
  const avg = steps.reduce((a, b) => a + b, 0) / steps.length;
  return Math.round(avg);
}

function deriveOverrides(
  values: Map<string, number>,
  sizes: string[],
  defaultStep: number,
): Record<string, number> {
  const overrides: Record<string, number> = {};
  for (let i = 1; i < sizes.length; i++) {
    const prev = values.get(sizes[i - 1]!);
    const curr = values.get(sizes[i]!);
    const label = sizes[i]!;
    if (prev == null || curr == null) continue;
    const step = curr - prev;
    if (Math.abs(step - defaultStep) > 5) {
      overrides[label] = step;
    }
  }
  return overrides;
}

const MEASUREMENT_ALIASES: Record<string, string> = {
  CHEST: "BUST",
  SLEEVES: "SLEEVE_LENGTH",
  SLEEVE_LONG: "SLEEVE_LENGTH",
  FULL_SHIRT_LENGTH: "LENGTH",
  LENGTH_FRONT: "LENGTH",
  DAMAN: "SWEEP",
  DAMAN_SHORT: "SWEEP",
};

function normalizeMeasurement(key: string): string {
  return MEASUREMENT_ALIASES[key] ?? key;
}

const keyRows = parseCsv(readFileSync(join(DATA, "Measurement_Keys.csv"), "utf8"));
const catRows = parseCsv(readFileSync(join(DATA, "Categories.csv"), "utf8"));
const rawRows = parseCsv(
  readFileSync(join(DATA, "Raw_Size_Observations.csv"), "utf8"),
);

// Measurement keys
const measurementKeyDefs = keyRows.map((row) => {
  const key = row["Measurement Key"]!.trim();
  const label = row.Label?.trim() || labelFromKey(key);
  const unitNote = row["Default unit"]?.trim() ?? "";
  const isMetres = /metre/i.test(unitNote) || /FABRIC_|DUPATTA_|SHIRT_|BOTTOM_FABRIC|SECOND_FABRIC/.test(key);
  return {
    key,
    label,
    labelUr: label,
    bodyOrGarment: inferBodyOrGarment(key),
    anchorPoint: anchorForKey(key),
    helpText: isMetres
      ? `${label} — metres (stored as hundredths of a metre).`
      : `${label} — inches unless noted in the size chart.`,
  };
});

// Categories
const nameUrFallback: Record<string, string> = {
  KAMEEZ: "قمیض",
  KURTA: "کرتا",
  KURTI: "کرتی",
  TROUSER: "ٹراوزر",
  SHALWAR: "شلوار",
  DUPATTA: "دوپٹہ",
  SHAWL: "شawl",
  SAREE: "ساری",
  GOWN: "گاؤن",
  SKIRT: "اسکرٹ",
  LEHENGA: "لہنگا",
  ABAYA: "عبaya",
};

let sortOrder = 10;
const categorySeeds = catRows.map((row) => {
  const key = row["Category Key"]!.trim();
  const keys = row["Measurement keys"]!
    .split("|")
    .map((k) => k.trim())
    .filter(Boolean);
  const seed = {
    key,
    name: row.Category!.trim(),
    nameUr: nameUrFallback[key] ?? row.Category!.trim(),
    measurementKeys: keys,
    sortOrder: sortOrder++,
    productType: row.Type?.trim() ?? "wearable",
    typicalRange: row["Typical range"]?.trim() ?? "",
    evidenceStatus: row["Evidence status"]?.trim() ?? "Proposed",
    definition: row.Definition?.trim() ?? "",
  };
  return seed;
});

// Measured blocks from raw observations (body charts only where noted)
const BODY_SOURCES = new Set(["SRC05", "SRC06", "SRC07"]);
const GARMENT_OK_CATEGORIES = new Set(["KAMEEZ"]); // finished-garment charts

type Obs = {
  sourceId: string;
  category: string;
  size: string;
  measurement: string;
  value: number;
  basis: string;
};

const observations: Obs[] = rawRows
  .map((row) => ({
    sourceId: row["Source ID"]!.trim(),
    category: row.Category!.trim(),
    size: row.Size!.trim(),
    measurement: normalizeMeasurement(row.Measurement!.trim()),
    value: Number.parseFloat(row.Value!),
    basis: row["Measurement basis"]?.trim() ?? "",
  }))
  .filter((o) => Number.isFinite(o.value));

function observationsForCategory(categoryKey: string): Obs[] {
  return observations.filter((o) => {
    if (o.category !== categoryKey) return false;
    if (BODY_SOURCES.has(o.sourceId)) return true;
    if (GARMENT_OK_CATEGORIES.has(categoryKey)) return true;
    return false;
  });
}

const measuredCategories = [...new Set(observations.map((o) => o.category))];

const measuredBlocks: Array<{
  categoryKey: string;
  name: string;
  notes: string;
  sizeLabels: string[];
  baseSizeLabel: string;
  rows: Array<{
    measurementKey: string;
    baseValue: number;
    gradeIncrement: number;
    gradeOverrides: Record<string, number>;
    sortOrder: number;
  }>;
}> = [];

for (const categoryKey of measuredCategories) {
  const catObs = observationsForCategory(categoryKey);
  if (!catObs.length) continue;

  const catDef = categorySeeds.find((c) => c.key === categoryKey);
  const declaredKeys = catDef?.measurementKeys ?? [];

  const sizes = sortSizes([...new Set(catObs.map((o) => o.size))]);
  const baseSizeLabel = sizes.includes("M") ? "M" : (sizes[Math.floor(sizes.length / 2)] ?? "M");

  const measurementKeysInData = [
    ...new Set(catObs.map((o) => o.measurement)),
  ].filter((k) => declaredKeys.includes(k) || !declaredKeys.length);

  const orderedKeys =
    declaredKeys.length > 0
      ? declaredKeys.filter((k) => measurementKeysInData.includes(k))
      : measurementKeysInData;

  const rows: (typeof measuredBlocks)[0]["rows"] = [];
  let sort = 10;
  for (const measurementKey of orderedKeys) {
    const bySize = new Map<string, number>();
    for (const o of catObs.filter((x) => x.measurement === measurementKey)) {
      if (!bySize.has(o.size)) bySize.set(o.size, inches(o.value));
    }
    if (!bySize.has(baseSizeLabel)) continue;
    const baseValue = bySize.get(baseSizeLabel)!;
    const gradeIncrement = deriveGradeIncrement(bySize, sizes);
    const gradeOverrides = deriveOverrides(bySize, sizes, gradeIncrement);
    rows.push({
      measurementKey,
      baseValue,
      gradeIncrement,
      gradeOverrides,
      sortOrder: sort,
    });
    sort += 10;
  }

  if (!rows.length) continue;

  const basisNote = GARMENT_OK_CATEGORIES.has(categoryKey)
    ? "Research-backed default — finished/flat garment measurements (Rangreza / Sana Safinaz / Sapphire). Not body measurements."
    : "Research-backed default — body measurements (Anokherang charts). Replace with house pattern blocks when ready.";

  measuredBlocks.push({
    categoryKey,
    name: `${categoryKey} research default`,
    notes: basisNote,
    sizeLabels: sizes,
    baseSizeLabel,
    rows,
  });
}

// --- Write output ---

function tsString(s: string): string {
  return JSON.stringify(s);
}

const keysOut = `/** AUTO-GENERATED — run \`npx tsx scripts/generate-sizing-research-seeds.ts\` */
import type { BodyOrGarment, MeasurementKeyDef } from "../sizing-catalogue";

export const RESEARCH_MEASUREMENT_KEY_DEFS: readonly MeasurementKeyDef[] = [
${measurementKeyDefs
  .map(
    (d) => `  {
    key: ${tsString(d.key)},
    label: ${tsString(d.label)},
    labelUr: ${tsString(d.labelUr)},
    bodyOrGarment: ${tsString(d.bodyOrGarment)} as BodyOrGarment,
    anchorPoint: ${tsString(d.anchorPoint)},
    helpText: ${tsString(d.helpText)},
  }`,
  )
  .join(",\n")}
] as const;
`;

const catsOut = `/** AUTO-GENERATED — run \`npx tsx scripts/generate-sizing-research-seeds.ts\` */
import type { CategorySeed } from "../sizing-catalogue";

export const RESEARCH_GARMENT_CATEGORY_SEEDS: readonly CategorySeed[] = [
${categorySeeds
  .map(
    (c) => `  {
    key: ${tsString(c.key)},
    name: ${tsString(c.name)},
    nameUr: ${tsString(c.nameUr)},
    measurementKeys: [${c.measurementKeys.map((k) => tsString(k)).join(", ")}],
    sortOrder: ${c.sortOrder},
    productType: ${tsString(c.productType)},
    typicalRange: ${tsString(c.typicalRange)},
    evidenceStatus: ${tsString(c.evidenceStatus)},
    definition: ${tsString(c.definition)},
  }`,
  )
  .join(",\n")}
] as const;
`;

const blocksOut = `/** AUTO-GENERATED — run \`npx tsx scripts/generate-sizing-research-seeds.ts\` */
import type { SizeBlockSeed } from "../size-block-seeds";

export type ResearchSizeBlockSeed = SizeBlockSeed & {
  sizeLabels: readonly string[];
  baseSizeLabel: string;
};

export const RESEARCH_MEASURED_BLOCK_SEEDS: readonly ResearchSizeBlockSeed[] = [
${measuredBlocks
  .map(
    (b) => `  {
    categoryKey: ${tsString(b.categoryKey)},
    name: ${tsString(b.name)},
    notes: ${tsString(b.notes)},
    sizeLabels: [${b.sizeLabels.map((s) => tsString(s)).join(", ")}],
    baseSizeLabel: ${tsString(b.baseSizeLabel)},
    rows: [
${b.rows
  .map(
    (r) => `      {
        measurementKey: ${tsString(r.measurementKey)},
        baseValue: ${r.baseValue},
        gradeIncrement: ${r.gradeIncrement},
        gradeOverrides: ${JSON.stringify(r.gradeOverrides)},
        sortOrder: ${r.sortOrder},
      }`,
  )
  .join(",\n")}
    ],
  }`,
  )
  .join(",\n")}
] as const;
`;

mkdirSync(OUT, { recursive: true });

writeFileSync(join(OUT, "research-measurement-keys.ts"), keysOut);
writeFileSync(join(OUT, "research-categories.ts"), catsOut);
writeFileSync(join(OUT, "research-measured-blocks.ts"), blocksOut);

console.log(
  `[generate-sizing-research] ${measurementKeyDefs.length} keys, ${categorySeeds.length} categories, ${measuredBlocks.length} measured blocks`,
);
