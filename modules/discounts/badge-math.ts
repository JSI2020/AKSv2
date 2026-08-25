/** Pure badge math — keep out of server-only modules for unit tests. */

export function automaticPercentForDesign(input: {
  designId: string;
  freeTags: string[];
  garmentTypeKey: string;
  discounts: Array<{
    value: number;
    appliesTo:
      | "ORDER"
      | "COLLECTION"
      | "CATEGORY"
      | "DESIGN"
      | "GARMENT_TYPE";
    targetIds: string[];
  }>;
}): number | null {
  let best = 0;
  for (const d of input.discounts) {
    let applies = false;
    if (d.appliesTo === "ORDER") applies = true;
    else if (d.appliesTo === "DESIGN") {
      applies = d.targetIds.includes(input.designId);
    } else if (d.appliesTo === "GARMENT_TYPE") {
      applies = d.targetIds.includes(input.garmentTypeKey);
    } else if (d.appliesTo === "COLLECTION" || d.appliesTo === "CATEGORY") {
      applies = input.freeTags.some((t) =>
        d.targetIds.some((id) => {
          const a = id.toUpperCase();
          const b = t.toUpperCase();
          return (
            a === b ||
            a.toLowerCase() === t.toLowerCase() ||
            a.replace(/_/g, "") === b.replace(/_/g, "")
          );
        }),
      );
    }
    if (applies && d.value > best) best = d.value;
  }
  return best > 0 ? best : null;
}
