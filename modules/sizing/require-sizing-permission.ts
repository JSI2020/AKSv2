import {
  PermissionDeniedError,
  UnauthenticatedError,
  requirePermission,
  userHasPermission,
} from "@/modules/auth";

/**
 * Studio / design sizing: designs.edit or designs.create.
 * Settings blocks: settings.edit.
 */
export async function requireSizingEdit(designId?: string | null) {
  if (designId) {
    const { auth } = await import("@/auth");
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthenticatedError();
    }
    const canEdit = await userHasPermission(session.user.id, "designs.edit");
    const canCreate = await userHasPermission(
      session.user.id,
      "designs.create",
    );
    if (!canEdit && !canCreate) {
      throw new PermissionDeniedError("designs.edit");
    }
    return session;
  }
  return requirePermission("settings.edit");
}

export async function requireSizingView(designId?: string | null) {
  if (designId) {
    const { auth } = await import("@/auth");
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthenticatedError();
    }
    const canView = await userHasPermission(session.user.id, "designs.view");
    const canEdit = await userHasPermission(session.user.id, "designs.edit");
    const canCreate = await userHasPermission(
      session.user.id,
      "designs.create",
    );
    if (!canView && !canEdit && !canCreate) {
      throw new PermissionDeniedError("designs.view");
    }
    return session;
  }
  return requirePermission("settings.view");
}
