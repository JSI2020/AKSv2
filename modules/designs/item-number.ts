import { HOUSE_COLLECTIONS } from "@/modules/catalog/house-collections";

/** House door → item-number middle code. */
export const HOUSE_ITEM_CODES = {
  ESSENTIALS: "es",
  TAILORED: "tl",
  OCCASION: "oc",
  SIGNATURE: "sg",
  SEPARATES: "sp",
} as const;

export type HouseDoorTag = keyof typeof HOUSE_ITEM_CODES;
export type HouseItemCode = (typeof HOUSE_ITEM_CODES)[HouseDoorTag];

const HOUSE_TAG_SET = new Set(
  Object.keys(HOUSE_ITEM_CODES) as HouseDoorTag[],
);

export function isHouseDoorTag(value: string): value is HouseDoorTag {
  return HOUSE_TAG_SET.has(value as HouseDoorTag);
}

export function houseItemCode(tag: string): HouseItemCode | null {
  if (!isHouseDoorTag(tag)) return null;
  return HOUSE_ITEM_CODES[tag];
}

export function houseDoorOptions() {
  return HOUSE_COLLECTIONS.map((c) => ({
    tag: c.tag as HouseDoorTag,
    label: c.navLabel,
    code: HOUSE_ITEM_CODES[c.tag as HouseDoorTag],
  }));
}

const QUARTET_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomQuartet(): string {
  let out = "";
  for (let i = 0; i < 4; i++) {
    const idx = Math.floor(Math.random() * QUARTET_ALPHABET.length);
    out += QUARTET_ALPHABET[idx]!;
  }
  return out;
}

/** Format: AKS-{es|tl|oc|sg|sp}-{XXXX} */
export function formatItemNumber(code: HouseItemCode, quartet: string): string {
  return `AKS-${code}-${quartet.toUpperCase()}`;
}

export function parseItemNumberHouseCode(
  itemNumber: string,
): HouseItemCode | null {
  const m = /^AKS-(es|tl|oc|sg|sp)-[A-Z0-9]{4}$/i.exec(itemNumber.trim());
  return m ? (m[1]!.toLowerCase() as HouseItemCode) : null;
}

/**
 * Allocate a unique item number. `exists` returns true if the candidate is taken.
 */
export async function allocateItemNumber(
  houseTag: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const code = houseItemCode(houseTag);
  if (!code) {
    throw new Error(`Unknown house door for item number: ${houseTag}`);
  }
  for (let attempt = 0; attempt < 24; attempt++) {
    const candidate = formatItemNumber(code, randomQuartet());
    if (!(await exists(candidate))) return candidate;
  }
  throw new Error("Could not allocate a unique item number");
}

/** When house door changes, keep quartet if present; otherwise allocate fresh. */
export function rebuildItemNumberKeepingQuartet(
  previous: string | null | undefined,
  houseTag: string,
): string | null {
  const code = houseItemCode(houseTag);
  if (!code) return null;
  const m = /^AKS-(?:es|tl|oc|sg|sp)-([A-Z0-9]{4})$/i.exec(
    (previous ?? "").trim(),
  );
  if (m?.[1]) return formatItemNumber(code, m[1]);
  return formatItemNumber(code, randomQuartet());
}
