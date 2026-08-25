/** Manual inventory movement form types → signed delta + DB reason. */

export type ManualMovementType =
  | "RECEIVED"
  | "SOLD_OFFLINE"
  | "DAMAGE"
  | "COUNT_CORRECTION";

export type InventoryMovementReason =
  | ManualMovementType
  | "ORDER_DISPATCH";

export type LedgerMovementRow = {
  id: string;
  createdAt: Date;
  reason: InventoryMovementReason;
  delta: number;
  note: string | null;
  reference: string | null;
};

export type StockLedgerFigures = {
  onHand: number;
  reserved: number;
  available: number;
  /** Display unit: pcs | m (metres shown as decimal from hundredths). */
  unit: "pcs" | "m";
};

export type StockLedgerDetail = {
  title: string;
  subtitle: string;
  photoUrl: string | null;
  photoGradient: string | null;
  figures: StockLedgerFigures;
  movements: LedgerMovementRow[];
  /** Opaque stock key for the record-movement form. */
  stockKind: "rtw" | "fabric" | "packing" | "trim";
  stockId: string;
};

/** Positive quantity + type → signed integer delta (hundredths for fabric metres). */
export function deltaFromMovementType(
  type: ManualMovementType,
  quantity: number,
): number {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("Quantity must be a positive integer");
  }
  switch (type) {
    case "RECEIVED":
      return quantity;
    case "SOLD_OFFLINE":
    case "DAMAGE":
      return -quantity;
    case "COUNT_CORRECTION":
      // Form treats quantity as absolute adjustment magnitude with sign from a
      // separate field; callers pass already-signed quantity for corrections.
      return quantity;
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

export function movementLabel(reason: string): string {
  switch (reason) {
    case "RECEIVED":
      return "Received";
    case "SOLD_OFFLINE":
      return "Sold offline";
    case "DAMAGE":
      return "Damaged";
    case "COUNT_CORRECTION":
      return "Count correction";
    case "ORDER_DISPATCH":
      return "Order dispatch";
    case "SAMPLING":
      return "Sampling";
    case "CUTTING_WASTE":
      return "Cutting waste";
    case "RETURN":
      return "Return";
    case "OTHER":
      return "Other";
    default:
      return reason;
  }
}

export function movementTone(
  delta: number,
): "in" | "out" | "adj" {
  if (delta > 0) return "in";
  if (delta < 0) return "out";
  return "adj";
}

/** Map ledger UI type to fabric stock_adjustments reason. */
export function fabricAdjustReason(
  type: ManualMovementType,
): "DAMAGE" | "COUNT_CORRECTION" | "OTHER" {
  if (type === "DAMAGE") return "DAMAGE";
  if (type === "COUNT_CORRECTION") return "COUNT_CORRECTION";
  return "OTHER";
}

const SWATCH: Record<string, string> = {
  Ivory: "#EAE1CF",
  Bone: "#DDD2BC",
  Oyster: "#CDC0A8",
  Sand: "#BFAA88",
  Stone: "#A89A80",
  Taupe: "#8D7E66",
  "Tea Rose": "#C6A59B",
  "Antique gold": "#9A8A6B",
  Madder: "#6B3A3A",
  Black: "#22283A",
};

/** Soft swatch fill for inventory photo cards (not admin chrome). */
export function colourGradient(name: string, hex?: string | null): string {
  const c = hex ?? SWATCH[name] ?? "#CDC0A8";
  return `linear-gradient(155deg,${c}dd,${c})`;
}

export function swatchHex(name: string): string | null {
  return SWATCH[name] ?? null;
}
