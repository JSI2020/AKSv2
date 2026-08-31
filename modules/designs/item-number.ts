import {
  getHouseCollectionByTag,
  listHouseCollections,
} from "@/modules/catalog/house-collections-queries";

const QUARTET_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export async function isHouseDoorTag(value: string): Promise<boolean> {
  const row = await getHouseCollectionByTag(value);
  return Boolean(row);
}

export async function houseItemCodeForTag(tag: string): Promise<string | null> {
  const row = await getHouseCollectionByTag(tag);
  return row?.itemCode ?? null;
}

export async function houseDoorOptions() {
  const rows = await listHouseCollections({ activeOnly: true });
  return rows.map((c) => ({
    tag: c.tag,
    label: c.navLabel,
    code: c.itemCode,
  }));
}

function randomQuartet(): string {
  let out = "";
  for (let i = 0; i < 4; i++) {
    const idx = Math.floor(Math.random() * QUARTET_ALPHABET.length);
    out += QUARTET_ALPHABET[idx]!;
  }
  return out;
}

/** Format: AKS-{code}-{XXXX} */
export function formatItemNumber(itemCode: string, quartet: string): string {
  return `AKS-${itemCode.toLowerCase()}-${quartet.toUpperCase()}`;
}

export function parseItemNumberHouseCode(
  itemNumber: string,
): string | null {
  const m = /^AKS-([a-z0-9]{2})-[A-Z0-9]{4}$/i.exec(itemNumber.trim());
  return m ? m[1]!.toLowerCase() : null;
}

/**
 * Allocate a unique item number. `exists` returns true if the candidate is taken.
 */
export async function allocateItemNumber(
  itemCode: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const code = itemCode.trim().toLowerCase();
  if (code.length !== 2) {
    throw new Error(`Invalid item code: ${itemCode}`);
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
  itemCode: string,
): string | null {
  const code = itemCode.trim().toLowerCase();
  if (code.length !== 2) return null;
  const m = /^AKS-[a-z0-9]{2}-([A-Z0-9]{4})$/i.exec((previous ?? "").trim());
  if (m?.[1]) return formatItemNumber(code, m[1]);
  return formatItemNumber(code, randomQuartet());
}

/** Resolve item code from a house-door tag. */
export async function itemCodeForHouseTag(tag: string): Promise<string> {
  const code = await houseItemCodeForTag(tag);
  if (!code) throw new Error(`Unknown house door for item number: ${tag}`);
  return code;
}
