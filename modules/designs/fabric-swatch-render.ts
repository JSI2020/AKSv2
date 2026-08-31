/** Marker alt text for renders auto-linked from inventory fabric swatches. */
export const FABRIC_SWATCH_ALT = "__aks_fabric_swatch__";

export function isFabricSwatchRender(render: {
  altText: string | null | undefined;
}): boolean {
  return render.altText === FABRIC_SWATCH_ALT;
}

/** Customer-facing alt when a fabric swatch is ever shown outside admin. */
export function fabricSwatchDisplayAlt(fabricName: string): string {
  return `${fabricName} — fabric`;
}
