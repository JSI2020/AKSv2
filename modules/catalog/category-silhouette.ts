import type { SilhouetteId } from "@/modules/shop/home/silhouette-svg";

const CATEGORY_SILHOUETTE: Record<string, SilhouetteId> = {
  KAMEEZ: "kurta",
  KURTA: "kurta",
  SHIRT: "kurta",
  KURTI: "kurta",
  TUNIC: "kurta",
  LONG_GOWN: "farshi",
  MAXI: "farshi",
  ABAYA: "farshi",
  LEHENGA: "layered",
  SHARARA: "layered",
  GHARARA: "layered",
  PESHAWAZ: "peshwaz",
  ANGRAKHA: "angrakha",
};

export function silhouetteForCategory(categoryKey: string): SilhouetteId {
  return CATEGORY_SILHOUETTE[categoryKey.toUpperCase()] ?? "kurta";
}
