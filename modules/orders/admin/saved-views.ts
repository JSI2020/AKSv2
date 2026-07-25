"use client";

const STORAGE_KEY = "aks.admin.orders.savedViews";

export type SavedOrderView = {
  id: string;
  name: string;
  params: Record<string, string | string[] | boolean | null>;
  createdAt: string;
};

export function loadSavedViews(): SavedOrderView[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedOrderView[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistSavedViews(views: SavedOrderView[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
}

export function createSavedView(
  name: string,
  params: Record<string, string | string[] | boolean | null>,
): SavedOrderView {
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    params,
    createdAt: new Date().toISOString(),
  };
}

export const PRESET_VIEWS: SavedOrderView[] = [
  {
    id: "preset-awaiting-deposit",
    name: "Awaiting deposit",
    params: { payment: ["AWAITING_DEPOSIT"] },
    createdAt: "",
  },
  {
    id: "preset-at-risk",
    name: "At risk",
    params: { atRisk: true },
    createdAt: "",
  },
  {
    id: "preset-in-production",
    name: "In production",
    params: { production: ["CUTTING", "STITCHING", "QUALITY_CHECK"] },
    createdAt: "",
  },
];
