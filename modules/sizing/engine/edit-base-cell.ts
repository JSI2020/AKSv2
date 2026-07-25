import type { SizeBlockRowInput } from "./types";

/**
 * Edit the base-size value via delta (subtraction), never proportional scaling.
 * Grade increments are untouched — every size shifts by the same delta.
 */
export function editBaseCell<T extends SizeBlockRowInput>(
  row: T,
  newValue: number,
): T {
  const delta = newValue - row.baseValue;
  return {
    ...row,
    baseValue: row.baseValue + delta,
  };
}
