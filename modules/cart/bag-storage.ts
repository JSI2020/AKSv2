import type { CartLinePublic, CartPublic } from "./types";

const STORAGE_KEY = "aks-bag-v1";

export type StoredBagLine = {
  designId: string;
  colourwayId: string;
  sizeMode: "STANDARD" | "MADE_TO_MEASURE";
  sizeLabel: string | null;
  quantity: number;
  designSlug: string;
  designName: string;
  colourwayName: string;
  unitPriceMinor: number;
  thumbnailUrl: string | null;
  leadTimeDays: number | null;
  maxQuantity: number | null;
};

function isStoredLine(value: unknown): value is StoredBagLine {
  if (!value || typeof value !== "object") return false;
  const line = value as StoredBagLine;
  return (
    typeof line.designId === "string" &&
    typeof line.colourwayId === "string" &&
    (line.sizeMode === "STANDARD" || line.sizeMode === "MADE_TO_MEASURE") &&
    Number.isInteger(line.quantity) &&
    line.quantity > 0
  );
}

export function readStoredBag(): StoredBagLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { lines?: unknown };
    if (!Array.isArray(parsed.lines)) return [];
    return parsed.lines.filter(isStoredLine);
  } catch {
    return [];
  }
}

export function writeStoredBag(cart: CartPublic): void {
  if (typeof window === "undefined") return;
  try {
    if (cart.lines.length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const lines: StoredBagLine[] = cart.lines.map((line) => ({
      designId: line.designId,
      colourwayId: line.colourwayId,
      sizeMode: line.sizeMode,
      sizeLabel: line.sizeLabel,
      quantity: line.quantity,
      designSlug: line.designSlug,
      designName: line.designName,
      colourwayName: line.colourwayName,
      unitPriceMinor: line.unitPriceMinor,
      thumbnailUrl: line.thumbnailUrl,
      leadTimeDays: line.leadTimeDays,
      maxQuantity: line.maxQuantity,
    }));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ lines }));
  } catch {
    // Private mode and quota errors leave the server cart as the record.
  }
}

export function cartFromStoredBag(lines: StoredBagLine[]): CartPublic {
  const publicLines: CartLinePublic[] = lines.map((line, index) => ({
    id: `optimistic-stored-${index}`,
    designId: line.designId,
    designSlug: line.designSlug,
    designName: line.designName,
    colourwayId: line.colourwayId,
    colourwayName: line.colourwayName,
    sizeMode: line.sizeMode,
    sizeLabel: line.sizeLabel,
    quantity: line.quantity,
    maxQuantity: line.maxQuantity,
    unitPriceMinor: line.unitPriceMinor,
    lineTotalMinor: line.unitPriceMinor * line.quantity,
    thumbnailUrl: line.thumbnailUrl,
    leadTimeDays: line.leadTimeDays,
  }));
  return {
    id: "",
    lines: publicLines,
    itemCount: publicLines.reduce((sum, line) => sum + line.quantity, 0),
    subtotalMinor: publicLines.reduce((sum, line) => sum + line.lineTotalMinor, 0),
    leadTimeLabel: "",
  };
}
