export type ExpenditureCategory =
  | "RENT"
  | "SALARIES"
  | "MARKETING"
  | "UTILITIES"
  | "SOFTWARE"
  | "EQUIPMENT"
  | "MATERIALS"
  | "TAXES"
  | "OTHER";

export type ExpenditurePaymentMethod = "CASH" | "BANK_TRANSFER" | "CARD";

export type ExpenditureRecurrence = "MONTHLY" | "YEARLY";

export type ExpenditureRow = {
  id: string;
  date: Date;
  category: ExpenditureCategory;
  payee: string;
  amountMinor: number;
  paymentMethod: ExpenditurePaymentMethod;
  isRecurring: boolean;
  recurrenceCycle: ExpenditureRecurrence | null;
  endedAt: Date | null;
  note: string | null;
};

/** One occurrence of an expense inside a selected analysis range. */
export type ExpandedExpenditure = {
  sourceId: string;
  occurrenceDate: Date;
  category: ExpenditureCategory;
  payee: string;
  amountMinor: number;
  isRecurring: boolean;
  paymentMethod: ExpenditurePaymentMethod;
};

function monthStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function addMonths(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}

function yearStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
}

function addYears(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear() + n, 0, 1));
}

/**
 * Expand ledger rows into occurrences that fall in [from, to] (inclusive).
 * One-off: include if date in range.
 * Recurring MONTHLY/YEARLY: one amount per cycle overlapping the range,
 * from the row's date through endedAt (or open-ended).
 */
export function expandExpendituresForRange(
  rows: ExpenditureRow[],
  from: Date,
  to: Date,
): ExpandedExpenditure[] {
  const out: ExpandedExpenditure[] = [];

  for (const row of rows) {
    if (!row.isRecurring || !row.recurrenceCycle) {
      if (row.date >= from && row.date <= to) {
        out.push({
          sourceId: row.id,
          occurrenceDate: row.date,
          category: row.category,
          payee: row.payee,
          amountMinor: row.amountMinor,
          isRecurring: false,
          paymentMethod: row.paymentMethod,
        });
      }
      continue;
    }

    const endBound = row.endedAt && row.endedAt < to ? row.endedAt : to;
    if (row.date > endBound) continue;

    if (row.recurrenceCycle === "MONTHLY") {
      let cursor = monthStart(row.date < from ? from : row.date);
      const startFloor = monthStart(row.date);
      if (cursor < startFloor) cursor = startFloor;
      while (cursor <= endBound) {
        if (cursor >= from) {
          out.push({
            sourceId: row.id,
            occurrenceDate: cursor,
            category: row.category,
            payee: row.payee,
            amountMinor: row.amountMinor,
            isRecurring: true,
            paymentMethod: row.paymentMethod,
          });
        }
        cursor = addMonths(cursor, 1);
      }
    } else {
      let cursor = yearStart(row.date < from ? from : row.date);
      const startFloor = yearStart(row.date);
      if (cursor < startFloor) cursor = startFloor;
      while (cursor <= endBound) {
        if (cursor >= from) {
          out.push({
            sourceId: row.id,
            occurrenceDate: cursor,
            category: row.category,
            payee: row.payee,
            amountMinor: row.amountMinor,
            isRecurring: true,
            paymentMethod: row.paymentMethod,
          });
        }
        cursor = addYears(cursor, 1);
      }
    }
  }

  return out.sort(
    (a, b) => a.occurrenceDate.getTime() - b.occurrenceDate.getTime(),
  );
}

export function sumExpandedMinor(rows: ExpandedExpenditure[]): number {
  return rows.reduce((s, r) => s + r.amountMinor, 0);
}

export function sumRecurringExpandedMinor(rows: ExpandedExpenditure[]): number {
  return rows
    .filter((r) => r.isRecurring)
    .reduce((s, r) => s + r.amountMinor, 0);
}

export function categoryBreakdown(
  rows: ExpandedExpenditure[],
): Array<{ category: ExpenditureCategory; amountMinor: number }> {
  const map = new Map<ExpenditureCategory, number>();
  for (const r of rows) {
    map.set(r.category, (map.get(r.category) ?? 0) + r.amountMinor);
  }
  return [...map.entries()]
    .map(([category, amountMinor]) => ({ category, amountMinor }))
    .sort((a, b) => b.amountMinor - a.amountMinor);
}

export const EXPENDITURE_CATEGORY_LABELS: Record<ExpenditureCategory, string> =
  {
    RENT: "Rent",
    SALARIES: "Salaries",
    MARKETING: "Marketing",
    UTILITIES: "Utilities",
    SOFTWARE: "Software",
    EQUIPMENT: "Equipment",
    MATERIALS: "Materials",
    TAXES: "Taxes",
    OTHER: "Other",
  };
