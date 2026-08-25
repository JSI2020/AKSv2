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

/** Mock-aligned presets — chip counts come from overview, not these. */
export const PRESET_VIEWS: SavedOrderView[] = [
  {
    id: "preset-all-open",
    name: "All open",
    params: {
      production: [
        "RECEIVED",
        "CONFIRMED",
        "MEASUREMENTS_VERIFIED",
        "CUTTING",
        "STITCHING",
        "EMBROIDERY",
        "FINISHING",
        "QUALITY_CHECK",
        "PACKED",
        "DISPATCHED",
        "DELIVERED",
      ],
      due: null,
      completedThisMonth: null,
      payment: [],
    },
    createdAt: "",
  },
  {
    id: "preset-new",
    name: "New",
    params: {
      production: ["RECEIVED"],
      due: null,
      completedThisMonth: null,
      payment: [],
    },
    createdAt: "",
  },
  {
    id: "preset-in-progress",
    name: "In progress",
    params: {
      production: [
        "CONFIRMED",
        "MEASUREMENTS_VERIFIED",
        "CUTTING",
        "STITCHING",
        "EMBROIDERY",
        "FINISHING",
        "QUALITY_CHECK",
        "PACKED",
        "DISPATCHED",
        "DELIVERED",
      ],
      due: null,
      completedThisMonth: null,
      payment: [],
    },
    createdAt: "",
  },
  {
    id: "preset-overdue",
    name: "Overdue",
    params: {
      production: [],
      due: "overdue",
      completedThisMonth: null,
      payment: [],
    },
    createdAt: "",
  },
  {
    id: "preset-completed",
    name: "Completed",
    params: {
      production: ["COMPLETED"],
      due: null,
      completedThisMonth: true,
      payment: [],
    },
    createdAt: "",
  },
  {
    id: "preset-balance-due",
    name: "Balance due",
    params: {
      production: [],
      due: null,
      completedThisMonth: null,
      payment: ["BALANCE_DUE"],
    },
    createdAt: "",
  },
];
