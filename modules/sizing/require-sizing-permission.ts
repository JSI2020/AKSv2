import { requirePermission } from "@/modules/auth";

/**
 * Studio design sizing uses designs.create; settings blocks use settings.edit.
 */
export async function requireSizingEdit(designId?: string | null) {
  if (designId) {
    return requirePermission("designs.create");
  }
  return requirePermission("settings.edit");
}

export async function requireSizingView(designId?: string | null) {
  if (designId) {
    return requirePermission("designs.create");
  }
  return requirePermission("settings.view");
}
